import { getDatabase } from '../db/connection.js';
import { generateRandomToken, hashToken, hashPassword, generateToken, generateCsrfToken } from '../utils/security.js';
import { config } from '../config/env.js';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors.js';

const INVITATION_EXPIRY_DAYS = 7;
const NOTIFICATION_TYPES = [
  'task_assigned', 'mentioned', 'comment_added', 'status_changed',
  'deadline_upcoming', 'task_overdue', 'project_member_added',
  'project_member_removed', 'team_member_added', 'team_member_removed',
  'invitation_accepted', 'leave_requested', 'leave_decided'
];

export class InvitationService {
  static createInvitation(workspaceId, actor, { email, role }) {
    const db = getDatabase();
    const cleanEmail = email.trim().toLowerCase();

    // Manager role restriction
    if (actor.role === 'manager' && role !== 'member') {
      throw new ForbiddenError('Managers can only invite users with the Member role');
    }

    // Check if user already exists
    const existingUser = db.prepare(`
      SELECT id FROM users WHERE email = ? COLLATE NOCASE
    `).get(cleanEmail);

    if (existingUser) {
      throw new ConflictError('A user with this email address already exists');
    }

    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const tx = db.transaction(() => {
      // Clean up / revoke any expired invitations for this email in this workspace
      db.prepare(`
        UPDATE invitations
        SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE workspace_id = ? AND email = ? COLLATE NOCASE
          AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now')
      `).run(workspaceId, cleanEmail);

      // Check if an active unexpired invitation already exists
      const activeInvite = db.prepare(`
        SELECT id FROM invitations
        WHERE workspace_id = ? AND email = ? COLLATE NOCASE
          AND accepted_at IS NULL AND revoked_at IS NULL
      `).get(workspaceId, cleanEmail);

      if (activeInvite) {
        throw new ConflictError('An active invitation for this email already exists');
      }

      const insertResult = db.prepare(`
        INSERT INTO invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(workspaceId, cleanEmail, role, tokenHash, actor.id, expiresAt);

      return insertResult.lastInsertRowid;
    });

    const inviteId = tx();
    const inviteLink = `${config.CLIENT_ORIGIN}/accept-invite?token=${rawToken}`;
    const temporaryPassword = `TempPass${Math.floor(1000 + Math.random() * 9000)}!`;

    try {
      const admins = db.prepare(`SELECT id FROM users WHERE workspace_id = ? AND role = 'admin'`).all(workspaceId);
      const recipientIds = new Set();
      if (actor && actor.id) recipientIds.add(actor.id);
      for (const a of admins) recipientIds.add(a.id);

      const notifStmt = db.prepare(`
        INSERT INTO notifications (workspace_id, recipient_id, actor_id, type, title, message, entity_type, entity_id)
        VALUES (?, ?, ?, 'invitation_accepted', ?, ?, 'invitation', ?)
      `);
      for (const rId of recipientIds) {
        notifStmt.run(
          workspaceId,
          rId,
          actor.id,
          'Invitation Created',
          `Invitation created for ${cleanEmail} (${role}). Link and temporary password ready.`,
          inviteId
        );
      }
    } catch (e) {
      // Non-fatal
    }

    return {
      id: inviteId,
      email: cleanEmail,
      role,
      expiresAt,
      inviteLink,
      temporaryPassword
    };
  }

  static listInvitations(workspaceId, { status = 'all' } = {}) {
    const db = getDatabase();
    let query = `
      SELECT i.id, i.workspace_id, i.email, i.role, i.invited_by,
             u.name as invited_by_name, i.expires_at, i.accepted_at,
             i.accepted_user_id, i.revoked_at, i.created_at,
             CASE
               WHEN i.accepted_at IS NOT NULL THEN 'accepted'
               WHEN i.revoked_at IS NOT NULL THEN 'revoked'
               WHEN i.expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 'expired'
               ELSE 'pending'
             END as computed_status
      FROM invitations i
      JOIN users u ON u.id = i.invited_by
      WHERE i.workspace_id = ?
    `;

    const params = [workspaceId];

    if (status === 'pending') {
      query += ` AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now')`;
    } else if (status === 'accepted') {
      query += ` AND i.accepted_at IS NOT NULL`;
    } else if (status === 'revoked') {
      query += ` AND i.revoked_at IS NOT NULL`;
    } else if (status === 'expired') {
      query += ` AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now')`;
    }

    query += ' ORDER BY i.created_at DESC';

    return db.prepare(query).all(...params);
  }

  static revokeInvitation(workspaceId, invitationId, actor) {
    const db = getDatabase();
    const invite = db.prepare(`
      SELECT id, role, invited_by, accepted_at, revoked_at
      FROM invitations
      WHERE id = ? AND workspace_id = ?
    `).get(invitationId, workspaceId);

    if (!invite) {
      throw new NotFoundError('Invitation not found');
    }

    if (invite.accepted_at) {
      throw new BadRequestError('Cannot revoke an already accepted invitation');
    }

    if (invite.revoked_at) {
      return { success: true, message: 'Invitation already revoked' };
    }

    // Manager can only revoke invitations they created or member role
    if (actor.role === 'manager' && invite.invited_by !== actor.id && invite.role !== 'member') {
      throw new ForbiddenError('You do not have permission to revoke this invitation');
    }

    db.prepare(`
      UPDATE invitations
      SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(invitationId);

    return { success: true, message: 'Invitation revoked successfully' };
  }

  static regenerateInvitation(workspaceId, invitationId, actor) {
    const db = getDatabase();
    const invite = db.prepare(`
      SELECT id, email, role, invited_by, accepted_at
      FROM invitations
      WHERE id = ? AND workspace_id = ?
    `).get(invitationId, workspaceId);

    if (!invite) {
      throw new NotFoundError('Invitation not found');
    }

    if (invite.accepted_at) {
      throw new BadRequestError('Cannot regenerate link for an already accepted invitation');
    }

    // Manager permission check
    if (actor.role === 'manager' && invite.role !== 'member') {
      throw new ForbiddenError('Managers can only manage invitations for Members');
    }

    // Revoke old and create new
    this.revokeInvitation(workspaceId, invitationId, actor);
    return this.createInvitation(workspaceId, actor, {
      email: invite.email,
      role: invite.role
    });
  }

  static validateToken(rawToken) {
    const db = getDatabase();
    if (!rawToken) {
      throw new BadRequestError('Invitation token is required');
    }

    const tokenHash = hashToken(rawToken);
    const invite = db.prepare(`
      SELECT i.id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at,
             w.name as workspace_name
      FROM invitations i
      JOIN workspaces w ON w.id = i.workspace_id
      WHERE i.token_hash = ?
    `).get(tokenHash);

    if (!invite) {
      throw new NotFoundError('Invalid invitation token');
    }

    if (invite.accepted_at) {
      throw new BadRequestError('This invitation has already been accepted');
    }

    if (invite.revoked_at) {
      throw new BadRequestError('This invitation has been revoked');
    }

    const nowIso = new Date().toISOString();
    if (invite.expires_at < nowIso) {
      throw new BadRequestError('This invitation has expired');
    }

    return {
      valid: true,
      email: invite.email,
      role: invite.role,
      workspaceName: invite.workspace_name
    };
  }

  static async acceptInvitation(rawToken, { name, password, email }) {
    const db = getDatabase();
    if (!rawToken) {
      throw new BadRequestError('Invitation token is required');
    }

    const tokenHash = hashToken(rawToken);
    const invite = db.prepare(`
      SELECT i.id, i.workspace_id, i.email, i.role, i.invited_by, i.expires_at,
             i.accepted_at, i.revoked_at
      FROM invitations i
      WHERE i.token_hash = ?
    `).get(tokenHash);

    if (!invite) {
      throw new NotFoundError('Invalid invitation link');
    }

    if (invite.accepted_at) {
      throw new BadRequestError('This invitation has already been accepted');
    }

    if (invite.revoked_at) {
      throw new BadRequestError('This invitation has been revoked');
    }

    const nowIso = new Date().toISOString();
    if (invite.expires_at < nowIso) {
      throw new BadRequestError('This invitation has expired');
    }

    // Email must match invitation
    if (email.trim().toLowerCase() !== invite.email.toLowerCase()) {
      throw new BadRequestError('The provided email does not match the invitation email');
    }

    const passwordHash = await hashPassword(password);
    const currentYear = new Date().getUTCFullYear();

    const acceptTx = db.transaction(() => {
      // 1. Create user
      const userRes = db.prepare(`
        INSERT INTO users (workspace_id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `).run(invite.workspace_id, name.trim(), invite.email.toLowerCase(), passwordHash, invite.role);

      const userId = userRes.lastInsertRowid;

      // 2. Mark invitation accepted
      db.prepare(`
        UPDATE invitations
        SET accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            accepted_user_id = ?
        WHERE id = ?
      `).run(userId, invite.id);

      // 3. User preferences
      db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(userId);

      // 4. Default leave balances
      const wsSettings = db.prepare(`
        SELECT default_casual_leave_days, default_sick_leave_days, default_other_leave_days
        FROM workspace_settings WHERE workspace_id = ?
      `).get(invite.workspace_id);

      const insertBalance = db.prepare(`
        INSERT INTO leave_balances (workspace_id, user_id, leave_type, year, allocated_days)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertBalance.run(invite.workspace_id, userId, 'casual', currentYear, wsSettings.default_casual_leave_days);
      insertBalance.run(invite.workspace_id, userId, 'sick', currentYear, wsSettings.default_sick_leave_days);
      insertBalance.run(invite.workspace_id, userId, 'other', currentYear, wsSettings.default_other_leave_days);

      // 5. Notification settings
      const insertNotifSetting = db.prepare(`
        INSERT INTO notification_settings (user_id, notification_type, in_app_enabled)
        VALUES (?, ?, 1)
      `);
      for (const type of NOTIFICATION_TYPES) {
        insertNotifSetting.run(userId, type);
      }

      // 6. Notify inviter and admins (invitation_accepted)
      try {
        const admins = db.prepare(`SELECT id FROM users WHERE workspace_id = ? AND role = 'admin'`).all(invite.workspace_id);
        const recipientIds = new Set();
        if (invite.invited_by) recipientIds.add(invite.invited_by);
        for (const a of admins) recipientIds.add(a.id);
        recipientIds.delete(userId);

        const notifStmt = db.prepare(`
          INSERT INTO notifications (workspace_id, recipient_id, actor_id, type, title, message, entity_type, entity_id)
          VALUES (?, ?, ?, 'invitation_accepted', ?, ?, 'invitation', ?)
        `);
        for (const rId of recipientIds) {
          notifStmt.run(
            invite.workspace_id,
            rId,
            userId,
            'Invitation Accepted',
            `${name.trim()} (${invite.email}) accepted the invitation and joined as a ${invite.role}.`,
            invite.id
          );
        }
      } catch (e) {
        // Non-fatal
      }

      const user = db.prepare(`
        SELECT id, workspace_id, name, email, role, avatar_color, capacity_hours_per_week,
               is_active, must_change_password, token_version
        FROM users WHERE id = ?
      `).get(userId);

      const workspace = db.prepare('SELECT id, name, slug FROM workspaces WHERE id = ?').get(invite.workspace_id);

      return { user, workspace };
    });

    const result = acceptTx();

    const token = generateToken({
      id: result.user.id,
      workspace_id: result.user.workspace_id,
      role: result.user.role,
      token_version: result.user.token_version
    });
    const csrfToken = generateCsrfToken();

      return {
        user: result.user,
        workspace: result.workspace,
        token,
        csrfToken
      };
    }

    static async onboardInvitation(workspaceId, invitationId, actor, { name, password } = {}) {
      const db = getDatabase();
      const invite = db.prepare(`
        SELECT id, workspace_id, email, role, invited_by, accepted_at, revoked_at, expires_at
        FROM invitations
        WHERE id = ? AND workspace_id = ?
      `).get(invitationId, workspaceId);

      if (!invite) {
        throw new NotFoundError('Invitation not found');
      }

      if (invite.accepted_at) {
        throw new BadRequestError('This invitation has already been accepted');
      }

      if (invite.revoked_at) {
        throw new BadRequestError('This invitation has been revoked');
      }

      const memberName = (name || invite.email.split('@')[0]).trim();
      const memberPassword = password || `TempPass${Math.floor(1000 + Math.random() * 9000)}!`;
      const passwordHash = await hashPassword(memberPassword);
      const currentYear = new Date().getUTCFullYear();

      const acceptTx = db.transaction(() => {
        // 1. Create user in users table
        const userRes = db.prepare(`
          INSERT INTO users (workspace_id, name, email, password_hash, role, must_change_password)
          VALUES (?, ?, ?, ?, ?, 0)
        `).run(invite.workspace_id, memberName, invite.email.toLowerCase(), passwordHash, invite.role);

        const userId = userRes.lastInsertRowid;

        // 2. Mark invitation accepted
        db.prepare(`
          UPDATE invitations
          SET accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
              accepted_user_id = ?
          WHERE id = ?
        `).run(userId, invite.id);

        // 3. User preferences
        db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(userId);

        // 4. Default leave balances
        const wsSettings = db.prepare(`
          SELECT default_casual_leave_days, default_sick_leave_days, default_other_leave_days
          FROM workspace_settings WHERE workspace_id = ?
        `).get(invite.workspace_id);

        const insertBalance = db.prepare(`
          INSERT INTO leave_balances (workspace_id, user_id, leave_type, year, allocated_days)
          VALUES (?, ?, ?, ?, ?)
        `);
        insertBalance.run(invite.workspace_id, userId, 'casual', currentYear, wsSettings?.default_casual_leave_days || 12);
        insertBalance.run(invite.workspace_id, userId, 'sick', currentYear, wsSettings?.default_sick_leave_days || 6);
        insertBalance.run(invite.workspace_id, userId, 'other', currentYear, wsSettings?.default_other_leave_days || 0);

        // 5. Notification settings
        const insertNotifSetting = db.prepare(`
          INSERT INTO notification_settings (user_id, notification_type, in_app_enabled)
          VALUES (?, ?, 1)
        `);
        for (const type of NOTIFICATION_TYPES) {
          insertNotifSetting.run(userId, type);
        }

        // 6. Notify inviter & admins
        try {
          const admins = db.prepare(`SELECT id FROM users WHERE workspace_id = ? AND role = 'admin'`).all(invite.workspace_id);
          const recipientIds = new Set();
          if (actor && actor.id) recipientIds.add(actor.id);
          if (invite.invited_by) recipientIds.add(invite.invited_by);
          for (const a of admins) recipientIds.add(a.id);

          const notifStmt = db.prepare(`
            INSERT INTO notifications (workspace_id, recipient_id, actor_id, type, title, message, entity_type, entity_id)
            VALUES (?, ?, ?, 'invitation_accepted', ?, ?, 'invitation', ?)
          `);
          for (const rId of recipientIds) {
            notifStmt.run(
              invite.workspace_id,
              rId,
              userId,
              'Member Onboarded',
              `${memberName} (${invite.email}) has been onboarded and joined the workspace as a ${invite.role}.`,
              invite.id
            );
          }
        } catch (e) {
          // Non-fatal
        }

        return db.prepare(`
          SELECT id, workspace_id, name, email, role, avatar_color, capacity_hours_per_week,
                 is_active, must_change_password
          FROM users WHERE id = ?
        `).get(userId);
      });

      const user = acceptTx();
      return {
        user,
        email: invite.email,
        temporaryPassword: memberPassword
      };
    }

    static async directOnboardMember(workspaceId, actor, { email, name, role = 'member', password } = {}) {
      const db = getDatabase();
      const cleanEmail = email.trim().toLowerCase();

      // Check if user already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(cleanEmail);
      if (existingUser) {
        throw new ConflictError('A user with this email address already exists');
      }

      const memberName = (name || cleanEmail.split('@')[0]).trim();
      const memberPassword = password || `TempPass${Math.floor(1000 + Math.random() * 9000)}!`;
      const passwordHash = await hashPassword(memberPassword);
      const currentYear = new Date().getUTCFullYear();

      const tx = db.transaction(() => {
        // 1. Insert user
        const userRes = db.prepare(`
          INSERT INTO users (workspace_id, name, email, password_hash, role, must_change_password)
          VALUES (?, ?, ?, ?, ?, 0)
        `).run(workspaceId, memberName, cleanEmail, passwordHash, role);

        const userId = userRes.lastInsertRowid;

        // 2. Insert into invitations as accepted for audit record
        const tokenHash = hashToken(generateRandomToken(32));
        db.prepare(`
          INSERT INTO invitations (workspace_id, email, role, token_hash, invited_by, expires_at, accepted_at, accepted_user_id)
          VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)
        `).run(workspaceId, cleanEmail, role, tokenHash, actor.id, userId);

        // 3. User preferences
        db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(userId);

        // 4. Leave balances
        const wsSettings = db.prepare(`
          SELECT default_casual_leave_days, default_sick_leave_days, default_other_leave_days
          FROM workspace_settings WHERE workspace_id = ?
        `).get(workspaceId);

        const insertBalance = db.prepare(`
          INSERT INTO leave_balances (workspace_id, user_id, leave_type, year, allocated_days)
          VALUES (?, ?, ?, ?, ?)
        `);
        insertBalance.run(workspaceId, userId, 'casual', currentYear, wsSettings?.default_casual_leave_days || 12);
        insertBalance.run(workspaceId, userId, 'sick', currentYear, wsSettings?.default_sick_leave_days || 6);
        insertBalance.run(workspaceId, userId, 'other', currentYear, wsSettings?.default_other_leave_days || 0);

        // 5. Notification settings
        const insertNotifSetting = db.prepare(`
          INSERT INTO notification_settings (user_id, notification_type, in_app_enabled)
          VALUES (?, ?, 1)
        `);
        for (const type of NOTIFICATION_TYPES) {
          insertNotifSetting.run(userId, type);
        }

        // 6. Notify workspace admins
        try {
          const admins = db.prepare(`SELECT id FROM users WHERE workspace_id = ? AND role = 'admin'`).all(workspaceId);
          const recipientIds = new Set();
          if (actor && actor.id) recipientIds.add(actor.id);
          for (const a of admins) recipientIds.add(a.id);

          const notifStmt = db.prepare(`
            INSERT INTO notifications (workspace_id, recipient_id, actor_id, type, title, message, entity_type, entity_id)
            VALUES (?, ?, ?, 'invitation_accepted', ?, ?, 'user', ?)
          `);
          for (const rId of recipientIds) {
            notifStmt.run(
              workspaceId,
              rId,
              userId,
              'Teammate Added',
              `${memberName} (${cleanEmail}) has been directly added to the workspace as a ${role}.`,
              userId
            );
          }
        } catch (e) {
          // Non-fatal
        }

        return db.prepare(`
          SELECT id, workspace_id, name, email, role, avatar_color, capacity_hours_per_week,
                 is_active, must_change_password
          FROM users WHERE id = ?
        `).get(userId);
      });

      const user = tx();
      return {
        user,
        email: cleanEmail,
        temporaryPassword: memberPassword
      };
    }
  }

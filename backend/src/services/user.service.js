import crypto from 'crypto';
import { getDatabase } from '../db/connection.js';
import { hashPassword } from '../utils/security.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';

export class UserService {
  static listUsers(workspaceId, { search, role, isActive, page = 1, pageSize = 20 } = {}) {
    const db = getDatabase();
    const conditions = ['workspace_id = ?'];
    const params = [workspaceId];

    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }

    if (isActive !== undefined && isActive !== null && isActive !== '') {
      conditions.push('is_active = ?');
      params.push(isActive === 'true' || isActive === 1 || isActive === true ? 1 : 0);
    }

    const whereClause = conditions.join(' AND ');

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM users WHERE ${whereClause}`).get(...params);
    const total = countRow.count;

    const offset = (Math.max(1, page) - 1) * pageSize;
    params.push(pageSize, offset);

    const users = db.prepare(`
      SELECT id, workspace_id, name, email, role, avatar_color, capacity_hours_per_week,
             is_active, must_change_password, last_login_at, created_at, updated_at
      FROM users
      WHERE ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `).all(...params);

    return {
      data: users,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static getUserById(workspaceId, userId) {
    const db = getDatabase();
    const user = db.prepare(`
      SELECT id, workspace_id, name, email, role, avatar_color, capacity_hours_per_week,
             is_active, must_change_password, last_login_at, created_at, updated_at
      FROM users
      WHERE id = ? AND workspace_id = ?
    `).get(userId, workspaceId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  static updateProfile(workspaceId, userId, { name, avatar_color, timezone }) {
    const db = getDatabase();
    const user = this.getUserById(workspaceId, userId);

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (avatar_color) {
      updates.push('avatar_color = ?');
      params.push(avatar_color);
    }

    if (updates.length > 0) {
      updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
      params.push(userId, workspaceId);

      db.prepare(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = ? AND workspace_id = ?
      `).run(...params);
    }

    if (timezone !== undefined) {
      db.prepare(`
        UPDATE user_preferences
        SET timezone = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE user_id = ?
      `).run(timezone, userId);
    }

    return this.getUserById(workspaceId, userId);
  }

  static getPreferences(userId) {
    const db = getDatabase();
    const prefs = db.prepare(`
      SELECT theme, timezone, onboarding_dismissed
      FROM user_preferences
      WHERE user_id = ?
    `).get(userId);

    return prefs || { theme: 'light', timezone: null, onboarding_dismissed: 0 };
  }

  static updatePreferences(userId, { theme, timezone, onboarding_dismissed }) {
    const db = getDatabase();
    const current = this.getPreferences(userId);

    const newTheme = theme !== undefined ? theme : current.theme;
    const newTz = timezone !== undefined ? timezone : current.timezone;
    const newDismissed = onboarding_dismissed !== undefined ? (onboarding_dismissed ? 1 : 0) : current.onboarding_dismissed;

    db.prepare(`
      INSERT INTO user_preferences (user_id, theme, timezone, onboarding_dismissed)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        timezone = excluded.timezone,
        onboarding_dismissed = excluded.onboarding_dismissed,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    `).run(userId, newTheme, newTz, newDismissed);

    return this.getPreferences(userId);
  }

  static updateUser(workspaceId, userId, { name, capacity_hours_per_week }) {
    const db = getDatabase();
    this.getUserById(workspaceId, userId); // Ensure user exists

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (capacity_hours_per_week !== undefined) {
      updates.push('capacity_hours_per_week = ?');
      params.push(capacity_hours_per_week);
    }

    if (updates.length === 0) {
      return this.getUserById(workspaceId, userId);
    }

    updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
    params.push(userId, workspaceId);

    db.prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ? AND workspace_id = ?
    `).run(...params);

    return this.getUserById(workspaceId, userId);
  }

  static changeRole(workspaceId, targetUserId, newRole, actorId) {
    const db = getDatabase();

    if (Number(targetUserId) === Number(actorId)) {
      throw new ForbiddenError('You cannot change your own role');
    }

    const targetUser = this.getUserById(workspaceId, targetUserId);

    // Last admin protection
    if (targetUser.role === 'admin' && newRole !== 'admin') {
      const adminCount = db.prepare(`
        SELECT COUNT(*) as count FROM users
        WHERE workspace_id = ? AND role = 'admin' AND is_active = 1
      `).get(workspaceId).count;

      if (adminCount <= 1) {
        throw new BadRequestError('Cannot demote the last active Administrator in the workspace');
      }
    }

    // Role change bumps token_version to invalidate existing sessions
    db.prepare(`
      UPDATE users
      SET role = ?,
          token_version = token_version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND workspace_id = ?
    `).run(newRole, targetUserId, workspaceId);

    return this.getUserById(workspaceId, targetUserId);
  }

  static toggleStatus(workspaceId, targetUserId, isActive, actorId) {
    const db = getDatabase();

    if (Number(targetUserId) === Number(actorId)) {
      throw new ForbiddenError('You cannot deactivate your own account');
    }

    const targetUser = this.getUserById(workspaceId, targetUserId);
    const newStatus = isActive ? 1 : 0;

    // Last active admin protection
    if (targetUser.role === 'admin' && newStatus === 0) {
      const adminCount = db.prepare(`
        SELECT COUNT(*) as count FROM users
        WHERE workspace_id = ? AND role = 'admin' AND is_active = 1
      `).get(workspaceId).count;

      if (adminCount <= 1) {
        throw new BadRequestError('Cannot deactivate the last active Administrator in the workspace');
      }
    }

    // Deactivating bumps token_version to immediately revoke sessions
    db.prepare(`
      UPDATE users
      SET is_active = ?,
          token_version = token_version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND workspace_id = ?
    `).run(newStatus, targetUserId, workspaceId);

    return this.getUserById(workspaceId, targetUserId);
  }

  static async issueTemporaryPassword(workspaceId, targetUserId) {
    const db = getDatabase();
    this.getUserById(workspaceId, targetUserId); // Validate exists

    // Generate readable random temporary password meeting min 8 chars, 1 letter, 1 number
    const randomChars = crypto.randomBytes(4).toString('hex'); // 8 hex chars
    const temporaryPassword = `Temp${randomChars}9!`;
    const passwordHash = await hashPassword(temporaryPassword);

    db.prepare(`
      UPDATE users
      SET password_hash = ?,
          must_change_password = 1,
          token_version = token_version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND workspace_id = ?
    `).run(passwordHash, targetUserId, workspaceId);

    return {
      userId: targetUserId,
      temporaryPassword
    };
  }
}

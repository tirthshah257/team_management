import { getDatabase } from '../db/connection.js';
import { hashPassword, comparePassword, generateToken, generateCsrfToken } from '../utils/security.js';
import { ForbiddenError, UnauthorizedError, BadRequestError } from '../utils/errors.js';

const NOTIFICATION_TYPES = [
  'task_assigned', 'mentioned', 'comment_added', 'status_changed',
  'deadline_upcoming', 'task_overdue', 'project_member_added',
  'project_member_removed', 'team_member_added', 'team_member_removed',
  'invitation_accepted', 'leave_requested', 'leave_decided'
];

export class AuthService {
  static getRegistrationStatus() {
    const db = getDatabase();
    const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    return { canRegister: count === 0 };
  }

  static getSystemMembers() {
    const db = getDatabase();
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color, u.workspace_id,
             w.name as workspace_name
      FROM users u
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      WHERE u.is_active = 1
      ORDER BY 
        CASE u.role 
          WHEN 'admin' THEN 1 
          WHEN 'manager' THEN 2 
          WHEN 'member' THEN 3 
          ELSE 4 
        END,
        u.id ASC
    `).all();

    return users.map(u => {
      let defaultPassword = 'Member123!';
      if (u.role === 'admin') defaultPassword = 'Admin123!';
      else if (u.role === 'manager') defaultPassword = 'Manager123!';
      return {
        ...u,
        defaultPassword
      };
    });
  }

  static async quickLogin({ email, userId }) {
    const db = getDatabase();
    let user;
    if (userId) {
      user = db.prepare(`
        SELECT id, workspace_id, name, email, password_hash, role, avatar_color,
               capacity_hours_per_week, is_active, must_change_password, token_version
        FROM users WHERE id = ?
      `).get(userId);
    } else if (email) {
      const cleanEmail = (email || '').trim().toLowerCase();
      user = db.prepare(`
        SELECT id, workspace_id, name, email, password_hash, role, avatar_color,
               capacity_hours_per_week, is_active, must_change_password, token_version
        FROM users WHERE email = ? COLLATE NOCASE
      `).get(cleanEmail);
    }

    if (!user || !user.is_active) {
      throw new UnauthorizedError('User account not found or is inactive');
    }

    // Update last_login_at
    db.prepare(`
      UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?
    `).run(user.id);

    const workspace = db.prepare(`
      SELECT id, name, slug FROM workspaces WHERE id = ?
    `).get(user.workspace_id);

    const token = generateToken({
      id: user.id,
      workspace_id: user.workspace_id,
      role: user.role,
      token_version: user.token_version
    });
    const csrfToken = generateCsrfToken();

    const { password_hash, ...safeUser } = user;

    return {
      user: safeUser,
      workspace,
      token,
      csrfToken
    };
  }

  static async registerFirstAdmin({ workspaceName, name, email, password }) {
    const db = getDatabase();

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount > 0) {
      throw new ForbiddenError('Registration is closed. New members must be invited by an administrator.');
    }

    const passwordHash = await hashPassword(password);
    const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
    const currentYear = new Date().getUTCFullYear();

    const transaction = db.transaction(() => {
      // 1. Create workspace
      const wsResult = db.prepare(`
        INSERT INTO workspaces (name, slug)
        VALUES (?, ?)
      `).run(workspaceName, slug);
      const workspaceId = wsResult.lastInsertRowid;

      // 2. Create workspace settings
      db.prepare(`
        INSERT INTO workspace_settings (workspace_id)
        VALUES (?)
      `).run(workspaceId);

      // 3. Create Admin user
      const userResult = db.prepare(`
        INSERT INTO users (workspace_id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, 'admin')
      `).run(workspaceId, name, email.toLowerCase(), passwordHash);
      const userId = userResult.lastInsertRowid;

      // 4. Update workspace created_by
      db.prepare(`
        UPDATE workspaces SET created_by = ? WHERE id = ?
      `).run(userId, workspaceId);

      // 5. Create user preferences
      db.prepare(`
        INSERT INTO user_preferences (user_id)
        VALUES (?)
      `).run(userId);

      // 6. Create default leave balances for current year
      const wsSettings = db.prepare(`
        SELECT default_casual_leave_days, default_sick_leave_days, default_other_leave_days
        FROM workspace_settings WHERE workspace_id = ?
      `).get(workspaceId);

      const insertBalance = db.prepare(`
        INSERT INTO leave_balances (workspace_id, user_id, leave_type, year, allocated_days)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertBalance.run(workspaceId, userId, 'casual', currentYear, wsSettings.default_casual_leave_days);
      insertBalance.run(workspaceId, userId, 'sick', currentYear, wsSettings.default_sick_leave_days);
      insertBalance.run(workspaceId, userId, 'other', currentYear, wsSettings.default_other_leave_days);

      // 7. Create default notification settings
      const insertNotifSetting = db.prepare(`
        INSERT INTO notification_settings (user_id, notification_type, in_app_enabled)
        VALUES (?, ?, 1)
      `);
      for (const type of NOTIFICATION_TYPES) {
        insertNotifSetting.run(userId, type);
      }

      const createdUser = db.prepare(`
        SELECT id, workspace_id, name, email, role, avatar_color, capacity_hours_per_week,
               is_active, must_change_password, token_version
        FROM users WHERE id = ?
      `).get(userId);

      const workspace = db.prepare('SELECT id, name, slug FROM workspaces WHERE id = ?').get(workspaceId);

      return { user: createdUser, workspace };
    });

    const result = transaction();
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

  static async login({ email, password }) {
    const db = getDatabase();
    const cleanEmail = (email || '').trim().toLowerCase();

    const user = db.prepare(`
      SELECT id, workspace_id, name, email, password_hash, role, avatar_color,
             capacity_hours_per_week, is_active, must_change_password, token_version
      FROM users WHERE email = ? COLLATE NOCASE
    `).get(cleanEmail);

    // Generic error message to prevent email enumeration
    if (!user || !user.is_active) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last_login_at
    db.prepare(`
      UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?
    `).run(user.id);

    const workspace = db.prepare(`
      SELECT id, name, slug FROM workspaces WHERE id = ?
    `).get(user.workspace_id);

    const token = generateToken({
      id: user.id,
      workspace_id: user.workspace_id,
      role: user.role,
      token_version: user.token_version
    });
    const csrfToken = generateCsrfToken();

    // Sanitize user object
    const { password_hash, ...safeUser } = user;

    return {
      user: safeUser,
      workspace,
      token,
      csrfToken
    };
  }

  static async getMe(userId) {
    const db = getDatabase();

    const user = db.prepare(`
      SELECT id, workspace_id, name, email, role, avatar_color, capacity_hours_per_week,
             is_active, must_change_password, token_version, last_login_at, created_at
      FROM users WHERE id = ?
    `).get(userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const workspace = db.prepare(`
      SELECT w.id, w.name, w.slug,
             ws.timezone, ws.working_days, ws.default_capacity_hours_per_week
      FROM workspaces w
      JOIN workspace_settings ws ON ws.workspace_id = w.id
      WHERE w.id = ?
    `).get(user.workspace_id);

    const preferences = db.prepare(`
      SELECT theme, timezone, onboarding_dismissed
      FROM user_preferences WHERE user_id = ?
    `).get(userId);

    return {
      user,
      workspace,
      preferences: preferences || { theme: 'light', timezone: null, onboarding_dismissed: 0 }
    };
  }

  static async changePassword(userId, { currentPassword, newPassword }) {
    const db = getDatabase();

    const user = db.prepare('SELECT id, password_hash, token_version, workspace_id, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const isValid = await comparePassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw new BadRequestError('Current password does not match');
    }

    const newHash = await hashPassword(newPassword);
    const newTokenVersion = user.token_version + 1;

    db.prepare(`
      UPDATE users
      SET password_hash = ?,
          must_change_password = 0,
          token_version = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(newHash, newTokenVersion, userId);

    const newToken = generateToken({
      id: user.id,
      workspace_id: user.workspace_id,
      role: user.role,
      token_version: newTokenVersion
    });

    return { newToken };
  }
}

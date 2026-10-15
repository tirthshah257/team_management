import { getDatabase } from '../db/connection.js';
import { NotFoundError } from '../utils/errors.js';

export class NotificationService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  notify({
    workspaceId,
    recipientId,
    actorId = null,
    type,
    title,
    message = null,
    entityType = null,
    entityId = null,
    deduplicationKey = null
  }) {
    if (recipientId === actorId) return null; // Don't notify oneself

    // Check user's notification preference
    const setting = this.db.prepare(`
      SELECT in_app_enabled FROM notification_settings
      WHERE user_id = ? AND notification_type = ?
    `).get(recipientId, type);

    if (setting && setting.in_app_enabled === 0) {
      return null;
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO notifications (
          workspace_id, recipient_id, actor_id, type,
          title, message, entity_type, entity_id, deduplication_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        workspaceId,
        recipientId,
        actorId,
        type,
        title,
        message,
        entityType,
        entityId,
        deduplicationKey
      );

      return result.lastInsertRowid;
    } catch (err) {
      // Ignore duplicate notification violations on deduplication_key
      if (err.message && err.message.includes('ux_notifications_dedup')) {
        return null;
      }
      throw err;
    }
  }

  listNotifications(userId, { page = 1, limit = 20, unreadOnly = false }) {
    const offset = (page - 1) * limit;

    let query = `
      SELECT n.*,
        u.name as actor_name,
        u.email as actor_email,
        u.avatar_color as actor_avatar_color
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.id
      WHERE n.recipient_id = ?
    `;
    const params = [userId];

    if (unreadOnly) {
      query += ' AND n.read_at IS NULL';
    }

    query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params);

    const countRow = this.db.prepare(`
      SELECT COUNT(*) as unread FROM notifications WHERE recipient_id = ? AND read_at IS NULL
    `).get(userId);

    return {
      notifications: rows,
      unread_count: countRow ? countRow.unread : 0,
      pagination: {
        page: Number(page),
        limit: Number(limit)
      }
    };
  }

  getUnreadCount(userId) {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND read_at IS NULL
    `).get(userId);
    return { count: row ? row.count : 0 };
  }

  markAsRead(notificationId, userId) {
    this.db.prepare(`
      UPDATE notifications
      SET read_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ? AND recipient_id = ?
    `).run(notificationId, userId);

    return { message: 'Notification marked as read' };
  }

  markAllAsRead(userId) {
    this.db.prepare(`
      UPDATE notifications
      SET read_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE recipient_id = ? AND read_at IS NULL
    `).run(userId);

    return { message: 'All notifications marked as read' };
  }

  getSettings(userId) {
    return this.db.prepare(`
      SELECT notification_type, in_app_enabled, updated_at
      FROM notification_settings
      WHERE user_id = ?
    `).all(userId);
  }

  updateSettings(userId, settings) {
    const stmt = this.db.prepare(`
      INSERT INTO notification_settings (user_id, notification_type, in_app_enabled)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, notification_type) DO UPDATE SET
        in_app_enabled = excluded.in_app_enabled,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `);

    const tx = this.db.transaction(() => {
      for (const s of settings) {
        stmt.run(userId, s.notification_type, s.in_app_enabled);
      }
    });

    tx();
    return this.getSettings(userId);
  }
}

import { getDatabase } from '../db/connection.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

export class AttendanceService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  getStatus(userId) {
    const today = new Date().toISOString().split('T')[0];

    const openSession = this.db.prepare(`
      SELECT * FROM attendance_logs
      WHERE user_id = ? AND check_out_at IS NULL
    `).get(userId);

    const todaySessions = this.db.prepare(`
      SELECT * FROM attendance_logs
      WHERE user_id = ? AND work_date = ?
    `).all(userId, today);

    let totalDurationSeconds = 0;
    for (const s of todaySessions) {
      if (s.check_out_at) {
        totalDurationSeconds += Math.max(0, Math.round((new Date(s.check_out_at) - new Date(s.check_in_at)) / 1000));
      } else {
        totalDurationSeconds += Math.max(0, Math.round((Date.now() - new Date(s.check_in_at)) / 1000));
      }
    }

    return {
      is_checked_in: !!openSession,
      current_session: openSession || null,
      today_duration_seconds: totalDurationSeconds
    };
  }

  checkIn(userId, workspaceId) {
    const status = this.getStatus(userId);
    if (status.is_checked_in) {
      throw new ValidationError('You are already checked in. Check out first before starting a new session.');
    }

    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    const res = this.db.prepare(`
      INSERT INTO attendance_logs (workspace_id, user_id, work_date, check_in_at)
      VALUES (?, ?, ?, ?)
    `).run(workspaceId, userId, today, nowIso);

    return this.db.prepare('SELECT * FROM attendance_logs WHERE id = ?').get(res.lastInsertRowid);
  }

  checkOut(userId) {
    const openSession = this.db.prepare(`
      SELECT * FROM attendance_logs
      WHERE user_id = ? AND check_out_at IS NULL
    `).get(userId);

    if (!openSession) {
      throw new ValidationError('You do not have an active check-in session');
    }

    const nowIso = new Date().toISOString();

    this.db.prepare(`
      UPDATE attendance_logs
      SET check_out_at = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(nowIso, openSession.id);

    return this.db.prepare('SELECT * FROM attendance_logs WHERE id = ?').get(openSession.id);
  }

  listAttendance({ workspaceId, user, from, to, targetUserId, allMembers = false }) {
    const wsId = workspaceId || user.workspace_id;

    let query = `
      SELECT al.*,
        u.name as user_name,
        u.email as user_email,
        u.avatar_color as user_avatar_color,
        u.role as user_role
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.workspace_id = ?
    `;
    const params = [wsId];

    // Restrict attendance logs:
    // By default, ONLY the logged-in user's attendance records are returned!
    if (user.role === 'member') {
      query += ' AND al.user_id = ?';
      params.push(user.id);
    } else if (targetUserId) {
      query += ' AND al.user_id = ?';
      params.push(targetUserId);
    } else if (!allMembers) {
      query += ' AND al.user_id = ?';
      params.push(user.id);
    }

    if (from) {
      query += ' AND al.work_date >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND al.work_date <= ?';
      params.push(to);
    }

    query += ' ORDER BY al.work_date DESC, al.check_in_at DESC LIMIT 100';
    return this.db.prepare(query).all(...params);
  }
}

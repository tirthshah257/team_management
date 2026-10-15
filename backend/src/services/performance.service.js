import { getDatabase } from '../db/connection.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

export class PerformanceService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  getMetrics({ workspaceId, user, month, targetUserId }) {
    const wsId = workspaceId || user.workspace_id;
    const reviewMonth = month || new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const monthStart = `${reviewMonth}-01`;
    const monthEnd = `${reviewMonth}-31`;

    let userQuery = `
      SELECT u.id, u.name, u.email, u.role, u.avatar_color, u.capacity_hours_per_week
      FROM users u
      WHERE u.workspace_id = ? AND u.is_active = 1
    `;
    const params = [wsId];

    if (user.role === 'member') {
      userQuery += ' AND u.id = ?';
      params.push(user.id);
    } else if (targetUserId) {
      userQuery += ' AND u.id = ?';
      params.push(targetUserId);
    }

    userQuery += ' ORDER BY u.name ASC';
    const users = this.db.prepare(userQuery).all(...params);

    const metrics = users.map(u => {
      // Completed tasks in month
      const completedTasks = this.db.prepare(`
        SELECT t.id, t.title, t.due_date, t.completed_at
        FROM tasks t
        JOIN task_assignees ta ON t.id = ta.task_id
        WHERE ta.user_id = ? AND t.status = 'done'
          AND strftime('%Y-%m', t.completed_at) = ?
      `).all(u.id, reviewMonth);

      const onTimeTasks = completedTasks.filter(t => !t.due_date || t.completed_at.slice(0, 10) <= t.due_date);
      const onTimeRate = completedTasks.length > 0 ? Math.round((onTimeTasks.length / completedTasks.length) * 100) : 100;

      // Hours logged in month
      const timeRow = this.db.prepare(`
        SELECT COALESCE(SUM(duration_seconds), 0) as total_sec
        FROM time_entries
        WHERE user_id = ? AND strftime('%Y-%m', entry_date) = ?
      `).get(u.id, reviewMonth);

      const hoursLogged = Math.round(((timeRow?.total_sec || 0) / 3600) * 10) / 10;

      // Review note
      const review = this.db.prepare(`
        SELECT pr.*, rev.name as reviewer_name
        FROM performance_reviews pr
        JOIN users rev ON pr.reviewer_id = rev.id
        WHERE pr.user_id = ? AND pr.review_month = ?
      `).get(u.id, reviewMonth);

      return {
        user: u,
        review_month: reviewMonth,
        completed_tasks_count: completedTasks.length,
        on_time_percentage: onTimeRate,
        hours_logged: hoursLogged,
        review: review || null
      };
    });

    return {
      review_month: reviewMonth,
      metrics
    };
  }

  saveReview({ workspaceId, reviewer, data }) {
    if (reviewer.role === 'member') {
      throw new ForbiddenError('Only Admins and Managers can submit performance reviews');
    }

    const wsId = workspaceId || reviewer.workspace_id;
    const targetUser = this.db.prepare('SELECT id, name FROM users WHERE id = ? AND workspace_id = ?').get(data.user_id, wsId);
    if (!targetUser) throw new NotFoundError('User not found');

    this.db.prepare(`
      INSERT INTO performance_reviews (workspace_id, user_id, reviewer_id, review_month, review_note)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, review_month) DO UPDATE SET
        reviewer_id = excluded.reviewer_id,
        review_note = excluded.review_note,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(wsId, data.user_id, reviewer.id, data.review_month, data.review_note);

    return this.getMetrics({ workspaceId: wsId, user: reviewer, month: data.review_month, targetUserId: data.user_id });
  }
}

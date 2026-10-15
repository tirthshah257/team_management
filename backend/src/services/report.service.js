import { getDatabase } from '../db/connection.js';

export class ReportService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  getProgressReport({ workspaceId, user }) {
    const wsId = workspaceId || user.workspace_id;

    let query = `
      SELECT p.id, p.name, p.color, p.status,
        COUNT(t.id) as total_tasks,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_tasks,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo_tasks
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL
      WHERE p.workspace_id = ? AND p.status != 'archived'
    `;
    const params = [wsId];

    if (user.role === 'member') {
      query += ' AND p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)';
      params.push(user.id);
    }

    query += ' GROUP BY p.id ORDER BY p.name ASC';
    const rows = this.db.prepare(query).all(...params);

    return rows.map(r => ({
      ...r,
      total_tasks: r.total_tasks || 0,
      done_tasks: r.done_tasks || 0,
      in_progress_tasks: r.in_progress_tasks || 0,
      todo_tasks: r.todo_tasks || 0,
      progress_percentage: r.total_tasks > 0 ? Math.round((r.done_tasks / r.total_tasks) * 100) : 0
    }));
  }

  getProductivityReport({ workspaceId, user, from, to }) {
    const wsId = workspaceId || user.workspace_id;
    const fromDate = from || '2026-01-01';
    const toDate = to || '2026-12-31';

    let query = `
      SELECT u.id, u.name, u.email, u.role, u.avatar_color,
        (
          SELECT COUNT(*)
          FROM tasks t
          JOIN task_assignees ta ON t.id = ta.task_id
          WHERE ta.user_id = u.id AND t.status = 'done' AND t.completed_at >= ? AND t.completed_at <= ?
        ) as completed_tasks,
        (
          SELECT COALESCE(SUM(te.duration_seconds), 0)
          FROM time_entries te
          WHERE te.user_id = u.id AND te.entry_date >= ? AND te.entry_date <= ?
        ) as total_seconds_logged
      FROM users u
      WHERE u.workspace_id = ? AND u.is_active = 1
    `;
    const params = [fromDate, `${toDate}T23:59:59Z`, fromDate, toDate, wsId];

    if (user.role === 'member') {
      query += ' AND u.id = ?';
      params.push(user.id);
    }

    query += ' ORDER BY completed_tasks DESC';
    const rows = this.db.prepare(query).all(...params);

    return rows.map(r => ({
      ...r,
      hours_logged: Math.round((r.total_seconds_logged / 3600) * 10) / 10
    }));
  }

  getTimeSpentReport({ workspaceId, user, from, to }) {
    const wsId = workspaceId || user.workspace_id;
    const fromDate = from || '2026-01-01';
    const toDate = to || '2026-12-31';

    const byProject = this.db.prepare(`
      SELECT p.id, p.name, p.color,
        COALESCE(SUM(te.duration_seconds), 0) as total_seconds
      FROM projects p
      JOIN tasks t ON p.id = t.project_id
      JOIN time_entries te ON t.id = te.task_id
      WHERE p.workspace_id = ? AND te.entry_date >= ? AND te.entry_date <= ?
      GROUP BY p.id
      ORDER BY total_seconds DESC
    `).all(wsId, fromDate, toDate);

    return {
      by_project: byProject.map(p => ({
        ...p,
        hours: Math.round((p.total_seconds / 3600) * 10) / 10
      }))
    };
  }

  generateCsvExport({ workspaceId, user, report = 'progress', from, to }) {
    if (report === 'productivity') {
      const data = this.getProductivityReport({ workspaceId, user, from, to });
      const headers = ['User ID', 'Name', 'Email', 'Role', 'Completed Tasks', 'Hours Logged'];
      const rows = data.map(d => [d.id, `"${d.name}"`, d.email, d.role, d.completed_tasks, d.hours_logged]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (report === 'time-spent') {
      const data = this.getTimeSpentReport({ workspaceId, user, from, to });
      const headers = ['Project ID', 'Project Name', 'Hours Logged'];
      const rows = data.by_project.map(d => [d.id, `"${d.name}"`, d.hours]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      const data = this.getProgressReport({ workspaceId, user });
      const headers = ['Project ID', 'Project Name', 'Status', 'Total Tasks', 'Done Tasks', 'In Progress', 'To Do', 'Progress %'];
      const rows = data.map(d => [d.id, `"${d.name}"`, d.status, d.total_tasks, d.done_tasks, d.in_progress_tasks, d.todo_tasks, d.progress_percentage]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
  }
}

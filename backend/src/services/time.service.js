import { getDatabase } from '../db/connection.js';
import { TaskService } from './task.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

export class TimeService {
  constructor(db) {
    this.db = db || getDatabase();
    this.taskService = new TaskService(this.db);
  }

  getActiveTimer(userId) {
    return this.db.prepare(`
      SELECT te.*,
        t.title as task_title,
        p.id as project_id,
        p.name as project_name,
        p.color as project_color
      FROM time_entries te
      JOIN tasks t ON te.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE te.user_id = ? AND te.entry_type = 'timer' AND te.ended_at IS NULL
    `).get(userId);
  }

  startTimer(taskId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.taskService.getAccessibleTask(taskId, user, wsId);

    if (task.project_status === 'archived') {
      throw new ValidationError('Cannot track time on tasks in an archived project');
    }

    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    const tx = this.db.transaction(() => {
      // 1. If another timer is running, stop it first
      const running = this.getActiveTimer(user.id);
      if (running) {
        const startMs = new Date(running.started_at).getTime();
        const durationSec = Math.max(1, Math.round((Date.now() - startMs) / 1000));
        this.db.prepare(`
          UPDATE time_entries
          SET ended_at = ?, duration_seconds = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          WHERE id = ?
        `).run(nowIso, durationSec, running.id);
      }

      // 2. Start new timer
      const res = this.db.prepare(`
        INSERT INTO time_entries (
          workspace_id, task_id, user_id, entry_type,
          entry_date, started_at, ended_at, duration_seconds
        ) VALUES (?, ?, ?, 'timer', ?, ?, NULL, NULL)
      `).run(wsId, taskId, user.id, today, nowIso);

      return res.lastInsertRowid;
    });

    const entryId = tx();
    return this.getActiveTimer(user.id);
  }

  stopTimer(taskId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const running = this.getActiveTimer(user.id);

    if (!running || (taskId && running.task_id !== Number(taskId))) {
      throw new ValidationError('No active timer running for this task');
    }

    const nowIso = new Date().toISOString();
    const startMs = new Date(running.started_at).getTime();
    const durationSec = Math.max(1, Math.round((Date.now() - startMs) / 1000));

    this.db.prepare(`
      UPDATE time_entries
      SET ended_at = ?, duration_seconds = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(nowIso, durationSec, running.id);

    return this.db.prepare(`
      SELECT te.*, t.title as task_title, p.name as project_name
      FROM time_entries te
      JOIN tasks t ON te.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE te.id = ?
    `).get(running.id);
  }

  createManualEntry({ workspaceId, user, data }) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.taskService.getAccessibleTask(data.task_id, user, wsId);

    if (task.project_status === 'archived') {
      throw new ValidationError('Cannot log time on tasks in an archived project');
    }

    const effectiveUserId = (user.role === 'admin' || user.role === 'manager') && data.user_id
      ? Number(data.user_id)
      : user.id;

    const res = this.db.prepare(`
      INSERT INTO time_entries (
        workspace_id, task_id, user_id, entry_type,
        entry_date, duration_seconds, note
      ) VALUES (?, ?, ?, 'manual', ?, ?, ?)
    `).run(
      wsId,
      data.task_id,
      effectiveUserId,
      data.entry_date,
      data.duration_seconds,
      data.note || null
    );

    return this.db.prepare(`
      SELECT te.*, t.title as task_title, p.name as project_name
      FROM time_entries te
      JOIN tasks t ON te.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE te.id = ?
    `).get(res.lastInsertRowid);
  }

  listTimeEntries({ workspaceId, user, from, to, taskId, projectId, targetUserId }) {
    const wsId = workspaceId || user.workspace_id;

    let query = `
      SELECT te.*,
        t.title as task_title,
        p.id as project_id,
        p.name as project_name,
        p.color as project_color,
        u.name as user_name,
        u.avatar_color as user_avatar_color
      FROM time_entries te
      JOIN tasks t ON te.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON te.user_id = u.id
      WHERE te.workspace_id = ? AND te.duration_seconds IS NOT NULL
    `;
    const params = [wsId];

    // Access control
    if (user.role === 'member') {
      query += ' AND te.user_id = ?';
      params.push(user.id);
    } else if (user.role === 'manager' && targetUserId) {
      query += ' AND te.user_id = ?';
      params.push(targetUserId);
    } else if (targetUserId) {
      query += ' AND te.user_id = ?';
      params.push(targetUserId);
    }

    if (from) {
      query += ' AND te.entry_date >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND te.entry_date <= ?';
      params.push(to);
    }
    if (taskId) {
      query += ' AND te.task_id = ?';
      params.push(taskId);
    }
    if (projectId) {
      query += ' AND t.project_id = ?';
      params.push(projectId);
    }

    query += ' ORDER BY te.entry_date DESC, te.created_at DESC LIMIT 100';
    return this.db.prepare(query).all(...params);
  }

  updateTimeEntry(id, user, data, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const entry = this.db.prepare('SELECT * FROM time_entries WHERE id = ? AND workspace_id = ?').get(id, wsId);
    if (!entry) throw new NotFoundError('Time entry not found');

    if (entry.user_id !== user.id && user.role !== 'admin') {
      throw new ForbiddenError('You can only edit your own time entries');
    }

    const updates = [];
    const params = [];
    if (data.entry_date !== undefined) {
      updates.push('entry_date = ?');
      params.push(data.entry_date);
    }
    if (data.duration_seconds !== undefined) {
      updates.push('duration_seconds = ?');
      params.push(data.duration_seconds);
    }
    if (data.note !== undefined) {
      updates.push('note = ?');
      params.push(data.note);
    }

    if (updates.length > 0) {
      updates.push("updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
      params.push(id);
      this.db.prepare(`UPDATE time_entries SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    return this.db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
  }

  deleteTimeEntry(id, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const entry = this.db.prepare('SELECT * FROM time_entries WHERE id = ? AND workspace_id = ?').get(id, wsId);
    if (!entry) throw new NotFoundError('Time entry not found');

    if (entry.user_id !== user.id && user.role !== 'admin') {
      throw new ForbiddenError('You can only delete your own time entries');
    }

    this.db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
    return { message: 'Time entry deleted successfully' };
  }

  getTimesheetGrid({ workspaceId, user, from, to, targetUserId }) {
    const wsId = workspaceId || user.workspace_id;
    const queryUserId = (user.role === 'admin' || user.role === 'manager') && targetUserId ? targetUserId : user.id;

    const fromDate = from || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const entries = this.db.prepare(`
      SELECT te.id, te.task_id, te.entry_date, te.duration_seconds, te.note,
             t.title as task_title, p.name as project_name, p.color as project_color
      FROM time_entries te
      JOIN tasks t ON te.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE te.workspace_id = ? AND te.user_id = ? AND te.entry_date >= ? AND te.entry_date <= ? AND te.duration_seconds IS NOT NULL
      ORDER BY te.entry_date ASC
    `).all(wsId, queryUserId, fromDate, toDate);

    // Group by task
    const taskMap = new Map();
    for (const e of entries) {
      if (!taskMap.has(e.task_id)) {
        taskMap.set(e.task_id, {
          task_id: e.task_id,
          task_title: e.task_title,
          project_name: e.project_name,
          project_color: e.project_color,
          total_seconds: 0,
          days: {}
        });
      }
      const item = taskMap.get(e.task_id);
      item.total_seconds += e.duration_seconds;
      item.days[e.entry_date] = (item.days[e.entry_date] || 0) + e.duration_seconds;
    }

    return {
      user_id: queryUserId,
      from: fromDate,
      to: toDate,
      rows: Array.from(taskMap.values()),
      total_logged_seconds: entries.reduce((s, e) => s + e.duration_seconds, 0)
    };
  }
}

import { getDatabase } from '../db/connection.js';

export class CalendarService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  getEvents({ workspaceId, user, from, to }) {
    const wsId = workspaceId || user.workspace_id;
    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate = to || new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

    // 1. Tasks in date range
    let taskQuery = `
      SELECT t.id, t.title, t.status, t.priority, t.start_date, t.due_date,
             p.id as project_id, p.name as project_name, p.color as project_color
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.workspace_id = ? AND t.deleted_at IS NULL AND p.status != 'archived'
        AND (
          (t.start_date IS NOT NULL AND t.start_date <= ? AND (t.due_date IS NULL OR t.due_date >= ?))
          OR (t.due_date IS NOT NULL AND t.due_date >= ? AND t.due_date <= ?)
        )
    `;
    const taskParams = [wsId, toDate, fromDate, fromDate, toDate];

    // Access control scoping
    if (user.role !== 'admin') {
      if (user.role === 'manager') {
        taskQuery += `
          AND (
            p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
            OR p.owner_id = ?
            OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?)
          )
        `;
        taskParams.push(user.id, user.id, user.id);
      } else {
        taskQuery += `
          AND (
            p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
            OR p.owner_id = ?
          )
        `;
        taskParams.push(user.id, user.id);
      }
    }

    const tasks = this.db.prepare(taskQuery).all(...taskParams);

    // 2. Approved leave requests in date range
    let leaveQuery = `
      SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.days,
             u.id as user_id, u.name as user_name, u.avatar_color
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.workspace_id = ? AND lr.status = 'approved'
        AND lr.start_date <= ? AND lr.end_date >= ?
    `;
    const leaveParams = [wsId, toDate, fromDate];

    if (user.role === 'member') {
      leaveQuery += ' AND lr.user_id = ?';
      leaveParams.push(user.id);
    }

    const leaves = this.db.prepare(leaveQuery).all(...leaveParams);

    // Format events for calendar UI / FullCalendar
    const taskEvents = tasks.map(t => ({
      id: `task-${t.id}`,
      taskId: t.id,
      title: t.title,
      start: t.start_date || t.due_date,
      end: t.due_date ? t.due_date : t.start_date,
      allDay: true,
      type: 'task',
      status: t.status,
      priority: t.priority,
      backgroundColor: t.project_color || '#4F46E5',
      borderColor: t.project_color || '#4F46E5',
      textColor: '#ffffff',
      extendedProps: {
        projectId: t.project_id,
        projectName: t.project_name,
        status: t.status,
        priority: t.priority
      }
    }));

    const leaveEvents = leaves.map(l => ({
      id: `leave-${l.id}`,
      leaveId: l.id,
      title: `${l.user_name} (${l.leave_type} leave)`,
      start: l.start_date,
      end: l.end_date,
      allDay: true,
      type: 'leave',
      backgroundColor: '#F59E0B',
      borderColor: '#D97706',
      textColor: '#ffffff',
      extendedProps: {
        userId: l.user_id,
        userName: l.user_name,
        leaveType: l.leave_type
      }
    }));

    return {
      events: [...taskEvents, ...leaveEvents],
      from: fromDate,
      to: toDate
    };
  }
}

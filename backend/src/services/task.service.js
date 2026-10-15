import { getDatabase } from '../db/connection.js';
import { ProjectService } from './project.service.js';
import { RecurrenceService } from './recurrence.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

export class TaskService {
  constructor(db) {
    this.db = db || getDatabase();
    this.projectService = new ProjectService(this.db);
    this.recurrenceService = new RecurrenceService(this.db);
  }

  getAccessibleTask(taskId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.db.prepare(`
      SELECT t.*, p.name as project_name, p.color as project_color, p.status as project_status, p.owner_id as project_owner_id, p.team_id as project_team_id
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND t.workspace_id = ?
    `).get(taskId, wsId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // Verify user can access the project
    this.projectService.getAccessibleProject(task.project_id, user, wsId);
    return task;
  }

  canEditTask(task, user) {
    if (user.role === 'admin' || user.role === 'manager') return true;
    // Members can edit tasks in projects they have access to
    return true;
  }

  canDeleteTask(task, user) {
    if (user.role === 'admin' || user.role === 'manager') return true;
    return task.created_by === user.id;
  }

  listProjectTasks({ projectId, user, workspaceId, status, priority, assigneeId, labelId, search, due }) {
    const wsId = workspaceId || user.workspace_id;
    // Verify access
    this.projectService.getAccessibleProject(projectId, user, wsId);

    let query = `
      SELECT t.*,
        u.name as creator_name,
        (SELECT COUNT(*) FROM subtasks st WHERE st.task_id = t.id) as subtask_count,
        (SELECT COUNT(*) FROM subtasks st WHERE st.task_id = t.id AND st.is_completed = 1) as subtask_completed_count
      FROM tasks t
      JOIN users u ON t.created_by = u.id
      WHERE t.project_id = ? AND t.workspace_id = ? AND t.deleted_at IS NULL
    `;
    const params = [projectId, wsId];

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }
    if (priority) {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }
    if (assigneeId) {
      query += ` AND t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)`;
      params.push(assigneeId);
    }
    if (labelId) {
      query += ` AND t.id IN (SELECT task_id FROM task_labels WHERE label_id = ?)`;
      params.push(labelId);
    }
    if (search) {
      query += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (due) {
      const today = new Date().toISOString().split('T')[0];
      if (due === 'overdue') {
        query += ` AND t.due_date < ? AND t.status != 'done'`;
        params.push(today);
      } else if (due === 'today') {
        query += ` AND t.due_date = ?`;
        params.push(today);
      }
    }

    query += ` ORDER BY t.position ASC, t.id ASC`;
    const tasks = this.db.prepare(query).all(...params);

    // Fetch assignees and labels in batch
    return this.enrichTasks(tasks);
  }

  enrichTasks(tasks) {
    if (tasks.length === 0) return [];
    const taskIds = tasks.map(t => t.id);
    const placeholders = taskIds.map(() => '?').join(',');

    const assignees = this.db.prepare(`
      SELECT ta.task_id, u.id, u.name, u.email, u.avatar_color
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id IN (${placeholders})
    `).all(...taskIds);

    const labels = this.db.prepare(`
      SELECT tl.task_id, l.id, l.name, l.color
      FROM task_labels tl
      JOIN labels l ON tl.label_id = l.id
      WHERE tl.task_id IN (${placeholders})
    `).all(...taskIds);

    const assigneesByTask = new Map();
    for (const a of assignees) {
      if (!assigneesByTask.has(a.task_id)) assigneesByTask.set(a.task_id, []);
      assigneesByTask.get(a.task_id).push(a);
    }

    const labelsByTask = new Map();
    for (const l of labels) {
      if (!labelsByTask.has(l.task_id)) labelsByTask.set(l.task_id, []);
      labelsByTask.get(l.task_id).push(l);
    }

    return tasks.map(t => ({
      ...t,
      assignees: assigneesByTask.get(t.id) || [],
      labels: labelsByTask.get(t.id) || []
    }));
  }

  getTask(taskId, user, workspaceId) {
    const task = this.getAccessibleTask(taskId, user, workspaceId);

    const assignees = this.db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_color, ta.assigned_at
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
    `).all(taskId);

    const labels = this.db.prepare(`
      SELECT l.id, l.name, l.color
      FROM task_labels tl
      JOIN labels l ON tl.label_id = l.id
      WHERE tl.task_id = ?
    `).all(taskId);

    const subtasks = this.db.prepare(`
      SELECT st.*, u.name as creator_name
      FROM subtasks st
      JOIN users u ON st.created_by = u.id
      WHERE st.task_id = ?
      ORDER BY st.sort_order ASC, st.id ASC
    `).all(taskId);

    let recurrenceRule = null;
    if (task.recurrence_rule_id) {
      recurrenceRule = this.db.prepare('SELECT * FROM recurring_task_rules WHERE id = ?').get(task.recurrence_rule_id);
    }

    return {
      ...task,
      assignees,
      labels,
      subtasks,
      recurrence_rule: recurrenceRule
    };
  }

  createTask({ projectId, user, data, workspaceId }) {
    const wsId = workspaceId || user.workspace_id;
    const project = this.projectService.getAccessibleProject(projectId, user, wsId);

    if (project.status === 'archived') {
      throw new ValidationError('Cannot create tasks in an archived project. Restore it first.');
    }

    // Validate assignees are project members
    if (Array.isArray(data.assignee_ids) && data.assignee_ids.length > 0) {
      for (const uid of data.assignee_ids) {
        const isMember = this.db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, uid);
        if (!isMember) {
          const userObj = this.db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
          throw new ValidationError(`User "${userObj?.name || uid}" must be a project member to be assigned to this task.`);
        }
      }
    }

    const status = data.status || 'todo';
    const completedAt = status === 'done' ? new Date().toISOString() : null;

    // Get max position in this status column
    const maxPosRow = this.db.prepare(`
      SELECT MAX(position) as max_pos
      FROM tasks
      WHERE project_id = ? AND status = ? AND deleted_at IS NULL
    `).get(projectId, status);
    const position = (maxPosRow?.max_pos || 0) + 1000;

    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO tasks (
          workspace_id, project_id, created_by, title, description,
          status, priority, start_date, due_date, estimated_minutes,
          position, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        wsId,
        projectId,
        user.id,
        data.title,
        data.description || null,
        status,
        data.priority || 'medium',
        data.start_date || null,
        data.due_date || null,
        data.estimated_minutes !== undefined ? data.estimated_minutes : null,
        position,
        completedAt
      );

      const taskId = result.lastInsertRowid;

      // Assignees
      if (Array.isArray(data.assignee_ids)) {
        const assignStmt = this.db.prepare(`
          INSERT INTO task_assignees (task_id, user_id, assigned_by)
          VALUES (?, ?, ?)
        `);
        for (const uid of data.assignee_ids) {
          assignStmt.run(taskId, uid, user.id);
        }
      }

      // Labels
      if (Array.isArray(data.label_ids)) {
        const labelStmt = this.db.prepare(`
          INSERT INTO task_labels (task_id, label_id)
          VALUES (?, ?)
        `);
        for (const lid of data.label_ids) {
          labelStmt.run(taskId, lid);
        }
      }

      return taskId;
    });

    const taskId = tx();
    return this.getTask(taskId, user, wsId);
  }

  updateTask({ taskId, user, data, workspaceId }) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.getAccessibleTask(taskId, user, wsId);

    if (task.project_status === 'archived') {
      throw new ValidationError('Cannot update task in an archived project. Restore the project first.');
    }

    if (!this.canEditTask(task, user)) {
      throw new ForbiddenError('You do not have permission to edit this task');
    }

    const updates = [];
    const params = [];
    let statusChangedToDone = false;

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.priority !== undefined) {
      updates.push('priority = ?');
      params.push(data.priority);
    }
    if (data.start_date !== undefined) {
      updates.push('start_date = ?');
      params.push(data.start_date);
    }
    if (data.due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(data.due_date);
    }
    if (data.estimated_minutes !== undefined) {
      updates.push('estimated_minutes = ?');
      params.push(data.estimated_minutes);
    }
    if (data.status !== undefined && data.status !== task.status) {
      updates.push('status = ?');
      params.push(data.status);
      if (data.status === 'done') {
        updates.push("completed_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
        statusChangedToDone = true;
      } else {
        updates.push('completed_at = NULL');
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
      params.push(taskId);

      this.db.prepare(`
        UPDATE tasks SET ${updates.join(', ')} WHERE id = ?
      `).run(...params);
    }

    // Trigger recurrence if completed
    if (statusChangedToDone && task.recurrence_rule_id) {
      this.recurrenceService.generateSuccessor(task);
    }

    return this.getTask(taskId, user, wsId);
  }

  moveTask({ taskId, user, data, workspaceId }) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.getAccessibleTask(taskId, user, wsId);

    if (task.project_status === 'archived') {
      throw new ValidationError('Cannot move tasks in an archived project.');
    }

    const { status, previous_task_id, next_task_id } = data;
    let newPosition = data.position;
    let statusChangedToDone = false;

    // Calculate fractional position if previous and/or next are provided
    if (newPosition === undefined) {
      if (previous_task_id && next_task_id) {
        const prev = this.db.prepare('SELECT position FROM tasks WHERE id = ?').get(previous_task_id);
        const next = this.db.prepare('SELECT position FROM tasks WHERE id = ?').get(next_task_id);
        if (prev && next) {
          newPosition = (prev.position + next.position) / 2;
          // Check for renormalization if gap is too small (< 0.001)
          if (Math.abs(next.position - prev.position) < 0.001) {
            this.renormalizeColumnPositions(task.project_id, status);
            const prevR = this.db.prepare('SELECT position FROM tasks WHERE id = ?').get(previous_task_id);
            const nextR = this.db.prepare('SELECT position FROM tasks WHERE id = ?').get(next_task_id);
            newPosition = (prevR.position + nextR.position) / 2;
          }
        }
      } else if (previous_task_id) {
        const prev = this.db.prepare('SELECT position FROM tasks WHERE id = ?').get(previous_task_id);
        newPosition = prev ? prev.position + 1000 : 1000;
      } else if (next_task_id) {
        const next = this.db.prepare('SELECT position FROM tasks WHERE id = ?').get(next_task_id);
        newPosition = next ? Math.max(1, next.position / 2) : 1000;
      } else {
        const maxPosRow = this.db.prepare(`
          SELECT MAX(position) as max_pos
          FROM tasks
          WHERE project_id = ? AND status = ? AND deleted_at IS NULL
        `).get(task.project_id, status);
        newPosition = (maxPosRow?.max_pos || 0) + 1000;
      }
    }

    const isDone = status === 'done';
    if (task.status !== 'done' && isDone) {
      statusChangedToDone = true;
    }

    this.db.prepare(`
      UPDATE tasks
      SET status = ?,
          position = ?,
          completed_at = CASE WHEN ? = 1 THEN (strftime('%Y-%m-%dT%H:%M:%fZ','now')) ELSE NULL END,
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(status, newPosition, isDone ? 1 : 0, taskId);

    if (statusChangedToDone && task.recurrence_rule_id) {
      this.recurrenceService.generateSuccessor(task);
    }

    return this.getTask(taskId, user, wsId);
  }

  renormalizeColumnPositions(projectId, status) {
    const tasks = this.db.prepare(`
      SELECT id FROM tasks
      WHERE project_id = ? AND status = ? AND deleted_at IS NULL
      ORDER BY position ASC, id ASC
    `).all(projectId, status);

    const stmt = this.db.prepare('UPDATE tasks SET position = ? WHERE id = ?');
    const tx = this.db.transaction(() => {
      tasks.forEach((t, index) => {
        stmt.run((index + 1) * 1000, t.id);
      });
    });
    tx();
  }

  softDeleteTask(taskId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.getAccessibleTask(taskId, user, wsId);

    if (!this.canDeleteTask(task, user)) {
      throw new ForbiddenError('You can only delete tasks you created');
    }

    this.db.prepare(`
      UPDATE tasks
      SET deleted_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(taskId);

    return { message: 'Task deleted successfully', taskId };
  }

  restoreTask(taskId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.getAccessibleTask(taskId, user, wsId);

    this.db.prepare(`
      UPDATE tasks
      SET deleted_at = NULL,
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(taskId);

    return this.getTask(taskId, user, wsId);
  }

  addAssignee(taskId, targetUserId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.getAccessibleTask(taskId, user, wsId);

    // Verify user is in project members
    const isMember = this.db.prepare(`
      SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?
    `).get(task.project_id, targetUserId);

    if (!isMember) {
      throw new ValidationError('User must be a member of the project before being assigned to this task');
    }

    this.db.prepare(`
      INSERT OR IGNORE INTO task_assignees (task_id, user_id, assigned_by)
      VALUES (?, ?, ?)
    `).run(taskId, targetUserId, user.id);

    return this.getTask(taskId, user, wsId);
  }

  removeAssignee(taskId, targetUserId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    this.getAccessibleTask(taskId, user, wsId);

    this.db.prepare(`
      DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?
    `).run(taskId, targetUserId);

    return this.getTask(taskId, user, wsId);
  }

  setTaskLabels(taskId, labelIds, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    this.getAccessibleTask(taskId, user, wsId);

    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM task_labels WHERE task_id = ?').run(taskId);
      const insert = this.db.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)');
      for (const lid of labelIds) {
        insert.run(taskId, lid);
      }
    });

    tx();
    return this.getTask(taskId, user, wsId);
  }

  getMyTasks(user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const today = new Date().toISOString().split('T')[0];

    // Calculate end of current week (Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sun
    const distanceToSunday = (7 - dayOfWeek) % 7;
    const endOfWeek = new Date(now.getTime() + distanceToSunday * 86400000).toISOString().split('T')[0];

    const tasks = this.db.prepare(`
      SELECT t.*, p.name as project_name, p.color as project_color,
        (SELECT COUNT(*) FROM subtasks st WHERE st.task_id = t.id) as subtask_count,
        (SELECT COUNT(*) FROM subtasks st WHERE st.task_id = t.id AND st.is_completed = 1) as subtask_completed_count
      FROM tasks t
      JOIN task_assignees ta ON t.id = ta.task_id
      JOIN projects p ON t.project_id = p.id
      WHERE ta.user_id = ? AND t.workspace_id = ? AND t.deleted_at IS NULL AND p.status != 'archived'
      ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC, t.priority DESC
    `).all(user.id, wsId);

    const enriched = this.enrichTasks(tasks);

    // Group tasks
    const groups = {
      overdue: [],
      today: [],
      this_week: [],
      later: [],
      no_date: [],
      completed: []
    };

    for (const t of enriched) {
      if (t.status === 'done') {
        groups.completed.push(t);
      } else if (!t.due_date) {
        groups.no_date.push(t);
      } else if (t.due_date < today) {
        groups.overdue.push(t);
      } else if (t.due_date === today) {
        groups.today.push(t);
      } else if (t.due_date <= endOfWeek) {
        groups.this_week.push(t);
      } else {
        groups.later.push(t);
      }
    }

    return {
      all: enriched,
      tasks: enriched,
      groups,
      counts: {
        overdue: groups.overdue.length,
        today: groups.today.length,
        this_week: groups.this_week.length,
        later: groups.later.length,
        no_date: groups.no_date.length,
        completed: groups.completed.length,
        total_active: enriched.filter(t => t.status !== 'done').length
      }
    };
  }

  listTasksForLogging(user, workspaceId, targetUserId) {
    const wsId = workspaceId || user.workspace_id;
    // Determine the user who performs the task
    const performerId = ((user.role === 'admin' || user.role === 'manager') && targetUserId)
      ? Number(targetUserId)
      : user.id;

    // Only return tasks assigned to the particular user who performs the task
    // (or created by them if no assignees have been assigned yet)
    const query = `
      SELECT t.id, t.title, t.status, t.priority, t.estimated_minutes,
             p.id as project_id, p.name as project_name, p.color as project_color,
             1 as is_assigned
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.workspace_id = ?
        AND t.deleted_at IS NULL
        AND p.status != 'archived'
        AND (
          EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)
          OR (t.created_by = ? AND NOT EXISTS(SELECT 1 FROM task_assignees ta2 WHERE ta2.task_id = t.id))
        )
      ORDER BY p.name ASC, t.title ASC
    `;

    return this.db.prepare(query).all(wsId, performerId, performerId);
  }
}

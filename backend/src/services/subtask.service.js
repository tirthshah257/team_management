import { getDatabase } from '../db/connection.js';
import { ProjectService } from './project.service.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export class SubtaskService {
  constructor(db) {
    this.db = db || getDatabase();
    this.projectService = new ProjectService(this.db);
  }

  getAccessibleSubtask(subtaskId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const subtask = this.db.prepare(`
      SELECT st.*, t.project_id, t.workspace_id, p.status as project_status
      FROM subtasks st
      JOIN tasks t ON st.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE st.id = ? AND t.workspace_id = ?
    `).get(subtaskId, wsId);

    if (!subtask) {
      throw new NotFoundError('Subtask not found');
    }

    this.projectService.getAccessibleProject(subtask.project_id, user, wsId);
    return subtask;
  }

  listSubtasks(taskId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.db.prepare('SELECT project_id, workspace_id FROM tasks WHERE id = ? AND workspace_id = ?').get(taskId, wsId);
    if (!task) throw new NotFoundError('Task not found');

    this.projectService.getAccessibleProject(task.project_id, user, wsId);

    return this.db.prepare(`
      SELECT st.*, u.name as creator_name
      FROM subtasks st
      JOIN users u ON st.created_by = u.id
      WHERE st.task_id = ?
      ORDER BY st.sort_order ASC, st.id ASC
    `).all(taskId);
  }

  createSubtask(taskId, user, data, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.db.prepare(`
      SELECT t.*, p.status as project_status
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND t.workspace_id = ?
    `).get(taskId, wsId);

    if (!task) throw new NotFoundError('Task not found');
    if (task.project_status === 'archived') {
      throw new ValidationError('Cannot add subtasks to an archived project');
    }

    this.projectService.getAccessibleProject(task.project_id, user, wsId);

    let sortOrder = data.sort_order;
    if (sortOrder === undefined) {
      const maxRow = this.db.prepare('SELECT MAX(sort_order) as max_sort FROM subtasks WHERE task_id = ?').get(taskId);
      sortOrder = (maxRow?.max_sort || 0) + 1;
    }

    const result = this.db.prepare(`
      INSERT INTO subtasks (task_id, title, sort_order, created_by)
      VALUES (?, ?, ?, ?)
    `).run(taskId, data.title, sortOrder, user.id);

    return this.db.prepare(`
      SELECT st.*, u.name as creator_name
      FROM subtasks st
      JOIN users u ON st.created_by = u.id
      WHERE st.id = ?
    `).get(result.lastInsertRowid);
  }

  updateSubtask(subtaskId, user, data, workspaceId) {
    const subtask = this.getAccessibleSubtask(subtaskId, user, workspaceId);

    if (subtask.project_status === 'archived') {
      throw new ValidationError('Cannot edit subtasks in an archived project');
    }

    const updates = [];
    const params = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.is_completed !== undefined) {
      updates.push('is_completed = ?');
      params.push(data.is_completed ? 1 : 0);
    }
    if (data.sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sort_order);
    }

    if (updates.length > 0) {
      updates.push("updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
      params.push(subtaskId);

      this.db.prepare(`
        UPDATE subtasks SET ${updates.join(', ')} WHERE id = ?
      `).run(...params);
    }

    return this.db.prepare(`
      SELECT st.*, u.name as creator_name
      FROM subtasks st
      JOIN users u ON st.created_by = u.id
      WHERE st.id = ?
    `).get(subtaskId);
  }

  deleteSubtask(subtaskId, user, workspaceId) {
    const subtask = this.getAccessibleSubtask(subtaskId, user, workspaceId);

    if (subtask.project_status === 'archived') {
      throw new ValidationError('Cannot delete subtasks in an archived project');
    }

    this.db.prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId);
    return { message: 'Subtask deleted successfully' };
  }
}

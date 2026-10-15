import { getDatabase } from '../db/connection.js';
import { TaskService } from './task.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

export class WorkloadService {
  constructor(db) {
    this.db = db || getDatabase();
    this.taskService = new TaskService(this.db);
  }

  getWorkload({ workspaceId, user, from, to, teamId }) {
    const wsId = workspaceId || user.workspace_id;

    // 1. Fetch relevant users based on role and team filter
    let userQuery = `
      SELECT u.id, u.name, u.email, u.role, u.avatar_color, u.capacity_hours_per_week
      FROM users u
      WHERE u.workspace_id = ? AND u.is_active = 1
    `;
    const userParams = [wsId];

    if (user.role === 'member') {
      throw new ForbiddenError('Only Admins and Managers can view Team Workload');
    }

    if (teamId) {
      userQuery += ' AND u.id IN (SELECT user_id FROM team_members WHERE team_id = ?)';
      userParams.push(teamId);
    }

    userQuery += ' ORDER BY u.name ASC';
    const users = this.db.prepare(userQuery).all(...userParams);

    // 2. For each user, calculate allocated tasks and hours
    const workload = users.map(u => {
      const tasks = this.db.prepare(`
        SELECT t.id, t.title, t.priority, t.status, t.due_date, t.estimated_minutes,
               p.id as project_id, p.name as project_name, p.color as project_color
        FROM tasks t
        JOIN task_assignees ta ON t.id = ta.task_id
        JOIN projects p ON t.project_id = p.id
        WHERE ta.user_id = ? AND t.workspace_id = ? AND t.deleted_at IS NULL AND t.status != 'done' AND p.status != 'archived'
        ORDER BY t.priority DESC, t.due_date ASC
      `).all(u.id, wsId);

      const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 60), 0);
      const allocatedHours = Math.round((totalMinutes / 60) * 10) / 10;
      const capacityHours = u.capacity_hours_per_week || 40;
      const utilization = Math.round((allocatedHours / capacityHours) * 100);

      let status = 'normal';
      if (utilization > 100) status = 'overloaded';
      else if (utilization >= 80) status = 'busy';

      return {
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar_color: u.avatar_color,
          capacity_hours: capacityHours
        },
        allocated_hours: allocatedHours,
        utilization_percentage: utilization,
        status,
        task_count: tasks.length,
        tasks
      };
    });

    return {
      workload,
      total_members: workload.length,
      overloaded_count: workload.filter(w => w.status === 'overloaded').length
    };
  }

  reassignTask({ taskId, fromUserId, toUserId, user, workspaceId }) {
    if (user.role === 'member') {
      throw new ForbiddenError('Only Admins and Managers can reassign tasks from workload');
    }

    const wsId = workspaceId || user.workspace_id;
    const task = this.taskService.getAccessibleTask(taskId, user, wsId);

    // Validate toUserId is in project members
    const isMember = this.db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, toUserId);
    if (!isMember) {
      throw new ValidationError('Target user must be a member of the task project to be assigned');
    }

    const tx = this.db.transaction(() => {
      if (fromUserId) {
        this.db.prepare('DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?').run(taskId, fromUserId);
      }
      this.db.prepare(`
        INSERT OR IGNORE INTO task_assignees (task_id, user_id, assigned_by)
        VALUES (?, ?, ?)
      `).run(taskId, toUserId, user.id);
    });

    tx();
    return this.taskService.getTask(taskId, user, wsId);
  }
}

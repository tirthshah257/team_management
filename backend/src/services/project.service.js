import { getDatabase } from '../db/connection.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

export class ProjectService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  /**
   * Check if a user can access a specific project.
   * Admin: workspace-wide.
   * Manager: if project member OR project owner OR project team member.
   * Member: if project member.
   * Returns project row or throws NotFoundError (404 to avoid leaking existence).
   */
  getAccessibleProject(projectId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const project = this.db.prepare(`
      SELECT p.*, t.name as team_name, u.name as owner_name, u.email as owner_email
      FROM projects p
      LEFT JOIN teams t ON p.team_id = t.id
      JOIN users u ON p.owner_id = u.id
      WHERE p.id = ? AND p.workspace_id = ?
    `).get(projectId, wsId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (user.role === 'admin') {
      return project;
    }

    // Check project_members
    const isMember = this.db.prepare(`
      SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?
    `).get(projectId, user.id);

    if (isMember || project.owner_id === user.id) {
      return project;
    }

    if (user.role === 'manager' && project.team_id) {
      const isTeamMember = this.db.prepare(`
        SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?
      `).get(project.team_id, user.id);
      if (isTeamMember) {
        return project;
      }
    }

    throw new NotFoundError('Project not found');
  }

  /**
   * Verify if user has management permissions on a project (Admin, owner, or Manager on project).
   */
  canManageProject(project, user) {
    if (user.role === 'admin') return true;
    if (project.owner_id === user.id) return true;
    if (user.role === 'manager') {
      const isMember = this.db.prepare(`
        SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?
      `).get(project.id, user.id);
      return !!isMember;
    }
    return false;
  }

  listProjects({ workspaceId, user, status, teamId, search, page = 1, limit = 50 }) {
    const wsId = workspaceId || user.workspace_id;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*,
        t.name as team_name,
        u.name as owner_name,
        u.avatar_color as owner_avatar_color,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks tsk WHERE tsk.project_id = p.id AND tsk.deleted_at IS NULL) as total_tasks,
        (SELECT COUNT(*) FROM tasks tsk WHERE tsk.project_id = p.id AND tsk.status = 'done' AND tsk.deleted_at IS NULL) as done_tasks,
        (SELECT COUNT(*) FROM tasks tsk WHERE tsk.project_id = p.id AND tsk.status = 'in_progress' AND tsk.deleted_at IS NULL) as in_progress_tasks,
        (SELECT COUNT(*) FROM tasks tsk WHERE tsk.project_id = p.id AND tsk.status = 'todo' AND tsk.deleted_at IS NULL) as todo_tasks
      FROM projects p
      LEFT JOIN teams t ON p.team_id = t.id
      JOIN users u ON p.owner_id = u.id
      WHERE p.workspace_id = ?
    `;
    const params = [wsId];

    // Access control filtering
    if (user.role !== 'admin') {
      if (user.role === 'manager') {
        query += `
          AND (
            p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
            OR p.owner_id = ?
            OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?)
          )
        `;
        params.push(user.id, user.id, user.id);
      } else {
        query += `
          AND (
            p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
            OR p.owner_id = ?
          )
        `;
        params.push(user.id, user.id);
      }
    }

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (teamId) {
      query += ` AND p.team_id = ?`;
      params.push(teamId);
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Count total matching
    const countSql = `SELECT COUNT(*) as total FROM (${query})`;
    const totalRow = this.db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;

    query += ` ORDER BY CASE p.status WHEN 'active' THEN 1 WHEN 'on_hold' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END, p.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params);

    const projects = rows.map(p => ({
      ...p,
      progress_percentage: p.total_tasks > 0 ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0
    }));

    return {
      projects,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  getProject(projectId, user, workspaceId) {
    const project = this.getAccessibleProject(projectId, user, workspaceId);

    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_tasks,
        SUM(estimated_minutes) as total_estimated_minutes
      FROM tasks
      WHERE project_id = ? AND deleted_at IS NULL
    `).get(projectId);

    const members = this.db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color, pm.joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY u.name ASC
    `).all(projectId);

    return {
      ...project,
      total_tasks: stats.total_tasks || 0,
      done_tasks: stats.done_tasks || 0,
      in_progress_tasks: stats.in_progress_tasks || 0,
      todo_tasks: stats.todo_tasks || 0,
      total_estimated_minutes: stats.total_estimated_minutes || 0,
      progress_percentage: stats.total_tasks > 0 ? Math.round(((stats.done_tasks || 0) / stats.total_tasks) * 100) : 0,
      members
    };
  }

  createProject({ workspaceId, user, data }) {
    if (user.role === 'member') {
      throw new ForbiddenError('Members cannot create projects');
    }

    const wsId = workspaceId || user.workspace_id;

    if (data.team_id) {
      const team = this.db.prepare('SELECT id FROM teams WHERE id = ? AND workspace_id = ?').get(data.team_id, wsId);
      if (!team) throw new ValidationError('Specified team does not exist in this workspace');
    }

    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO projects (workspace_id, team_id, owner_id, name, description, color, status, start_date, due_date)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `);

      const result = stmt.run(
        wsId,
        data.team_id || null,
        user.id,
        data.name,
        data.description || null,
        data.color || '#4F46E5',
        data.start_date || null,
        data.due_date || null
      );

      const projectId = result.lastInsertRowid;

      // Automatically add project creator/owner to project_members
      this.db.prepare(`
        INSERT INTO project_members (project_id, user_id, added_by)
        VALUES (?, ?, ?)
      `).run(projectId, user.id, user.id);

      // Add extra members if provided
      if (Array.isArray(data.member_ids)) {
        const addMemberStmt = this.db.prepare(`
          INSERT OR IGNORE INTO project_members (project_id, user_id, added_by)
          VALUES (?, ?, ?)
        `);
        for (const mId of data.member_ids) {
          if (mId !== user.id) {
            addMemberStmt.run(projectId, mId, user.id);
          }
        }
      }

      return projectId;
    });

    const projectId = tx();
    return this.getProject(projectId, user, wsId);
  }

  updateProject({ projectId, user, data, workspaceId }) {
    const project = this.getAccessibleProject(projectId, user, workspaceId);

    if (!this.canManageProject(project, user)) {
      throw new ForbiddenError('You do not have permission to edit this project');
    }

    if (project.status === 'archived' && data.status !== 'active') {
      throw new ValidationError('Archived projects are read-only. Restore the project to make edits.');
    }

    const wsId = workspaceId || user.workspace_id;

    if (data.team_id !== undefined && data.team_id !== null) {
      const team = this.db.prepare('SELECT id FROM teams WHERE id = ? AND workspace_id = ?').get(data.team_id, wsId);
      if (!team) throw new ValidationError('Specified team does not exist in this workspace');
    }

    const updates = [];
    const params = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.team_id !== undefined) {
      updates.push('team_id = ?');
      params.push(data.team_id);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
      if (data.status === 'archived') {
        updates.push("archived_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
      } else {
        updates.push('archived_at = NULL');
      }
    }
    if (data.start_date !== undefined) {
      updates.push('start_date = ?');
      params.push(data.start_date);
    }
    if (data.due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(data.due_date);
    }

    if (updates.length > 0) {
      updates.push("updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
      params.push(projectId);

      this.db.prepare(`
        UPDATE projects SET ${updates.join(', ')} WHERE id = ?
      `).run(...params);
    }

    return this.getProject(projectId, user, wsId);
  }

  archiveProject(projectId, user, workspaceId) {
    const project = this.getAccessibleProject(projectId, user, workspaceId);
    if (!this.canManageProject(project, user)) {
      throw new ForbiddenError('You do not have permission to archive this project');
    }

    this.db.prepare(`
      UPDATE projects
      SET status = 'archived',
          archived_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(projectId);

    return { message: 'Project archived successfully' };
  }

  restoreProject(projectId, user, workspaceId) {
    const project = this.getAccessibleProject(projectId, user, workspaceId);
    if (!this.canManageProject(project, user)) {
      throw new ForbiddenError('You do not have permission to restore this project');
    }

    this.db.prepare(`
      UPDATE projects
      SET status = 'active',
          archived_at = NULL,
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(projectId);

    return { message: 'Project restored successfully' };
  }

  deleteProject(projectId, user, workspaceId) {
    if (user.role !== 'admin') {
      throw new ForbiddenError('Only Admins can hard delete a project');
    }

    const project = this.getAccessibleProject(projectId, user, workspaceId);

    // Check if time entries exist for tasks in this project
    const hasTimeEntries = this.db.prepare(`
      SELECT 1
      FROM time_entries te
      JOIN tasks t ON te.task_id = t.id
      WHERE t.project_id = ?
      LIMIT 1
    `).get(projectId);

    if (hasTimeEntries) {
      throw new ValidationError('Cannot delete project with recorded time entries. Archive the project instead.');
    }

    this.db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    return { message: 'Project deleted successfully' };
  }

  listMembers(projectId, user, workspaceId) {
    this.getAccessibleProject(projectId, user, workspaceId);

    return this.db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color, pm.joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY u.name ASC
    `).all(projectId);
  }

  addMember(projectId, targetUserId, user, workspaceId) {
    const project = this.getAccessibleProject(projectId, user, workspaceId);
    if (!this.canManageProject(project, user)) {
      throw new ForbiddenError('You do not have permission to add members to this project');
    }

    const wsId = workspaceId || user.workspace_id;
    const targetUser = this.db.prepare('SELECT id, is_active FROM users WHERE id = ? AND workspace_id = ?').get(targetUserId, wsId);
    if (!targetUser || !targetUser.is_active) {
      throw new ValidationError('User does not exist or is inactive');
    }

    this.db.prepare(`
      INSERT OR IGNORE INTO project_members (project_id, user_id, added_by)
      VALUES (?, ?, ?)
    `).run(projectId, targetUserId, user.id);

    return this.listMembers(projectId, user, wsId);
  }

  removeMember(projectId, targetUserId, user, workspaceId) {
    const project = this.getAccessibleProject(projectId, user, workspaceId);
    if (!this.canManageProject(project, user)) {
      throw new ForbiddenError('You do not have permission to remove members from this project');
    }

    if (project.owner_id === targetUserId) {
      throw new ValidationError('Cannot remove the project owner. Reassign ownership first.');
    }

    this.db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, targetUserId);
    return this.listMembers(projectId, user, workspaceId);
  }

  addTeamMembers(projectId, teamId, user, workspaceId) {
    const project = this.getAccessibleProject(projectId, user, workspaceId);
    if (!this.canManageProject(project, user)) {
      throw new ForbiddenError('You do not have permission to modify project members');
    }

    const wsId = workspaceId || user.workspace_id;
    const teamMembers = this.db.prepare(`
      SELECT tm.user_id
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ? AND t.workspace_id = ? AND u.is_active = 1
    `).all(teamId, wsId);

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO project_members (project_id, user_id, added_by)
      VALUES (?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const m of teamMembers) {
        insertStmt.run(projectId, m.user_id, user.id);
      }
    });

    tx();
    return this.listMembers(projectId, user, wsId);
  }
}

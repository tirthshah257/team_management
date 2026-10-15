import { getDatabase } from '../db/connection.js';

export class SearchService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  globalSearch({ query, user, workspaceId, limit = 10 }) {
    if (!query || query.trim().length === 0) {
      return { projects: [], tasks: [], members: [] };
    }

    const wsId = workspaceId || user.workspace_id;
    const term = `%${query.trim()}%`;

    // 1. Accessible Projects
    let projectQuery = `
      SELECT p.id, p.name, p.description, p.color, p.status, 'project' as type
      FROM projects p
      WHERE p.workspace_id = ? AND (p.name LIKE ? OR p.description LIKE ?)
    `;
    const projParams = [wsId, term, term];

    if (user.role !== 'admin') {
      if (user.role === 'manager') {
        projectQuery += `
          AND (
            p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
            OR p.owner_id = ?
            OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?)
          )
        `;
        projParams.push(user.id, user.id, user.id);
      } else {
        projectQuery += `
          AND (
            p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
            OR p.owner_id = ?
          )
        `;
        projParams.push(user.id, user.id);
      }
    }
    projectQuery += ' ORDER BY p.updated_at DESC LIMIT ?';
    projParams.push(limit);

    const projects = this.db.prepare(projectQuery).all(...projParams);

    // 2. Accessible Tasks
    let taskQuery = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
             p.id as project_id, p.name as project_name, p.color as project_color,
             'task' as type
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.workspace_id = ? AND t.deleted_at IS NULL AND (t.title LIKE ? OR t.description LIKE ?)
    `;
    const taskParams = [wsId, term, term];

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
    taskQuery += ' ORDER BY t.updated_at DESC LIMIT ?';
    taskParams.push(limit);

    const tasks = this.db.prepare(taskQuery).all(...taskParams);

    // 3. Workspace Members
    const members = this.db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color, 'member' as type
      FROM users u
      WHERE u.workspace_id = ? AND u.is_active = 1 AND (u.name LIKE ? OR u.email LIKE ?)
      ORDER BY u.name ASC LIMIT ?
    `).all(wsId, term, term, limit);

    return {
      query: query.trim(),
      projects,
      tasks,
      members,
      total_count: projects.length + tasks.length + members.length
    };
  }
}

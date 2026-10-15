import { getDatabase } from '../db/connection.js';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors.js';

export class TeamService {
  static listTeams(workspaceId, user) {
    const db = getDatabase();

    // If Admin, can view all teams in workspace.
    // If Manager or Member, view teams they belong to.
    let query = `
      SELECT t.id, t.workspace_id, t.name, t.description, t.created_by,
             t.created_at, t.updated_at,
             (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count,
             (SELECT COUNT(*) FROM projects p WHERE p.team_id = t.id AND p.status != 'archived') as active_project_count
      FROM teams t
      WHERE t.workspace_id = ?
    `;
    const params = [workspaceId];

    if (user.role === 'member') {
      query += ` AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = ?)`;
      params.push(user.id);
    }

    query += ' ORDER BY t.name ASC';

    return db.prepare(query).all(...params);
  }

  static getTeamById(workspaceId, teamId, user) {
    const db = getDatabase();

    const team = db.prepare(`
      SELECT t.id, t.workspace_id, t.name, t.description, t.created_by,
             t.created_at, t.updated_at
      FROM teams t
      WHERE t.id = ? AND t.workspace_id = ?
    `).get(teamId, workspaceId);

    if (!team) {
      throw new NotFoundError('Team not found');
    }

    // Check membership access for member role
    const isMember = db.prepare(`
      SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?
    `).get(teamId, user.id);

    if (user.role === 'member' && !isMember) {
      // 404 to avoid leaking existence
      throw new NotFoundError('Team not found');
    }

    // Fetch team members with user details
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color, u.capacity_hours_per_week,
             u.is_active, tm.joined_at, tm.added_by
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ? AND u.workspace_id = ?
      ORDER BY u.name ASC
    `).all(teamId, workspaceId);

    // Fetch active projects associated with team
    const projects = db.prepare(`
      SELECT p.id, p.name, p.description, p.color, p.status, p.start_date, p.due_date,
             (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) as total_tasks,
             (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done' AND t.deleted_at IS NULL) as done_tasks
      FROM projects p
      WHERE p.team_id = ? AND p.workspace_id = ?
      ORDER BY p.status ASC, p.name ASC
    `).all(teamId, workspaceId);

    // Compute progress %
    const projectsWithProgress = projects.map(p => ({
      ...p,
      completion_percentage: p.total_tasks > 0 ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0
    }));

    return {
      ...team,
      is_member: Boolean(isMember),
      members,
      projects: projectsWithProgress
    };
  }

  static createTeam(workspaceId, user, { name, description }) {
    const db = getDatabase();

    // Admin or Manager only
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new ForbiddenError('Only Admins and Managers can create teams');
    }

    const cleanName = name.trim();

    // Check unique name in workspace
    const existing = db.prepare(`
      SELECT id FROM teams WHERE workspace_id = ? AND name = ? COLLATE NOCASE
    `).get(workspaceId, cleanName);

    if (existing) {
      throw new ConflictError('A team with this name already exists');
    }

    const createTx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO teams (workspace_id, name, description, created_by)
        VALUES (?, ?, ?, ?)
      `).run(workspaceId, cleanName, description ? description.trim() : null, user.id);

      const teamId = result.lastInsertRowid;

      // Automatically add the creator as a team member
      db.prepare(`
        INSERT INTO team_members (team_id, user_id, added_by)
        VALUES (?, ?, ?)
      `).run(teamId, user.id, user.id);

      return teamId;
    });

    const teamId = createTx();
    return this.getTeamById(workspaceId, teamId, user);
  }

  static updateTeam(workspaceId, teamId, user, { name, description }) {
    const db = getDatabase();
    const team = this.getTeamById(workspaceId, teamId, user);

    // Manager can only update teams they belong to
    if (user.role === 'manager') {
      const isMember = db.prepare(`
        SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?
      `).get(teamId, user.id);
      if (!isMember) {
        throw new ForbiddenError('You can only update teams you belong to');
      }
    } else if (user.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to update this team');
    }

    const updates = [];
    const params = [];

    if (name) {
      const cleanName = name.trim();
      const existing = db.prepare(`
        SELECT id FROM teams WHERE workspace_id = ? AND name = ? COLLATE NOCASE AND id != ?
      `).get(workspaceId, cleanName, teamId);
      if (existing) {
        throw new ConflictError('Another team already has this name');
      }
      updates.push('name = ?');
      params.push(cleanName);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description ? description.trim() : null);
    }

    if (updates.length > 0) {
      updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
      params.push(teamId, workspaceId);

      db.prepare(`
        UPDATE teams
        SET ${updates.join(', ')}
        WHERE id = ? AND workspace_id = ?
      `).run(...params);
    }

    return this.getTeamById(workspaceId, teamId, user);
  }

  static deleteTeam(workspaceId, teamId, user) {
    const db = getDatabase();
    this.getTeamById(workspaceId, teamId, user); // Validates existence & visibility

    if (user.role === 'manager') {
      const isMember = db.prepare(`
        SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?
      `).get(teamId, user.id);
      if (!isMember) {
        throw new ForbiddenError('You can only delete teams you belong to');
      }
    } else if (user.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to delete this team');
    }

    const deleteTx = db.transaction(() => {
      // Detach projects (team_id -> NULL), never delete projects!
      db.prepare(`
        UPDATE projects
        SET team_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE team_id = ? AND workspace_id = ?
      `).run(teamId, workspaceId);

      // Delete team (cascades to team_members)
      db.prepare('DELETE FROM teams WHERE id = ? AND workspace_id = ?').run(teamId, workspaceId);
    });

    deleteTx();
    return { success: true, message: 'Team deleted and projects detached' };
  }

  static addMember(workspaceId, teamId, targetUserId, actor) {
    const db = getDatabase();
    this.getTeamById(workspaceId, teamId, actor);

    // Check actor permission
    if (actor.role === 'manager') {
      const isMember = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, actor.id);
      if (!isMember) {
        throw new ForbiddenError('Managers can only manage members for teams they belong to');
      }
    } else if (actor.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to add members to this team');
    }

    // Check target user belongs to SAME workspace (prevent cross-workspace)
    const targetUser = db.prepare(`
      SELECT id, name FROM users WHERE id = ? AND workspace_id = ? AND is_active = 1
    `).get(targetUserId, workspaceId);

    if (!targetUser) {
      throw new NotFoundError('User not found in this workspace');
    }

    // Insert into team_members
    try {
      db.prepare(`
        INSERT INTO team_members (team_id, user_id, added_by)
        VALUES (?, ?, ?)
      `).run(teamId, targetUserId, actor.id);

      // In-app notification: team_member_added
      if (Number(targetUserId) !== Number(actor.id)) {
        const team = db.prepare('SELECT name FROM teams WHERE id = ?').get(teamId);
        db.prepare(`
          INSERT INTO notifications (workspace_id, recipient_id, actor_id, type, title, message, entity_type, entity_id)
          VALUES (?, ?, ?, 'team_member_added', ?, ?, 'team', ?)
        `).run(
          workspaceId,
          targetUserId,
          actor.id,
          'Added to Team',
          `You were added to team "${team.name}" by ${actor.name}.`,
          teamId
        );
      }
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError('User is already a member of this team');
      }
      throw err;
    }

    return this.getTeamById(workspaceId, teamId, actor);
  }

  static removeMember(workspaceId, teamId, targetUserId, actor) {
    const db = getDatabase();
    this.getTeamById(workspaceId, teamId, actor);

    if (actor.role === 'manager') {
      const isMember = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, actor.id);
      if (!isMember) {
        throw new ForbiddenError('Managers can only manage members for teams they belong to');
      }
    } else if (actor.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to remove members from this team');
    }

    const removed = db.prepare(`
      DELETE FROM team_members WHERE team_id = ? AND user_id = ?
    `).run(teamId, targetUserId);

    if (removed.changes === 0) {
      throw new NotFoundError('Member is not part of this team');
    }

    // In-app notification: team_member_removed
    if (Number(targetUserId) !== Number(actor.id)) {
      const team = db.prepare('SELECT name FROM teams WHERE id = ?').get(teamId);
      db.prepare(`
        INSERT INTO notifications (workspace_id, recipient_id, actor_id, type, title, message, entity_type, entity_id)
        VALUES (?, ?, ?, 'team_member_removed', ?, ?, 'team', ?)
      `).run(
        workspaceId,
        targetUserId,
        actor.id,
        'Removed from Team',
        `You were removed from team "${team.name}".`,
        teamId
      );
    }

    return this.getTeamById(workspaceId, teamId, actor);
  }
}

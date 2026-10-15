import { TeamService } from '../services/team.service.js';

export class TeamController {
  static list(req, res, next) {
    try {
      const teams = TeamService.listTeams(req.workspaceId, req.user);
      res.json({ data: teams });
    } catch (err) {
      next(err);
    }
  }

  static getById(req, res, next) {
    try {
      const team = TeamService.getTeamById(req.workspaceId, req.params.id, req.user);
      res.json({ data: team });
    } catch (err) {
      next(err);
    }
  }

  static create(req, res, next) {
    try {
      const team = TeamService.createTeam(req.workspaceId, req.user, req.body);
      res.status(201).json({ data: team });
    } catch (err) {
      next(err);
    }
  }

  static update(req, res, next) {
    try {
      const team = TeamService.updateTeam(req.workspaceId, req.params.id, req.user, req.body);
      res.json({ data: team });
    } catch (err) {
      next(err);
    }
  }

  static delete(req, res, next) {
    try {
      const result = TeamService.deleteTeam(req.workspaceId, req.params.id, req.user);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static addMember(req, res, next) {
    try {
      const team = TeamService.addMember(req.workspaceId, req.params.id, req.body.userId, req.user);
      res.status(201).json({ data: team });
    } catch (err) {
      next(err);
    }
  }

  static removeMember(req, res, next) {
    try {
      const team = TeamService.removeMember(req.workspaceId, req.params.id, req.params.userId, req.user);
      res.json({ data: team });
    } catch (err) {
      next(err);
    }
  }
}

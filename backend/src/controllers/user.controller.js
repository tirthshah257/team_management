import { UserService } from '../services/user.service.js';

export class UserController {
  static list(req, res, next) {
    try {
      const result = UserService.listUsers(req.workspaceId, {
        search: req.query.search,
        role: req.query.role,
        isActive: req.query.is_active,
        page: req.query.page,
        pageSize: req.query.pageSize
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static getById(req, res, next) {
    try {
      const user = UserService.getUserById(req.workspaceId, req.params.id);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  static updateProfile(req, res, next) {
    try {
      const updated = UserService.updateProfile(req.workspaceId, req.user.id, req.body);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static getPreferences(req, res, next) {
    try {
      const prefs = UserService.getPreferences(req.user.id);
      res.json({ data: prefs });
    } catch (err) {
      next(err);
    }
  }

  static updatePreferences(req, res, next) {
    try {
      const updated = UserService.updatePreferences(req.user.id, req.body);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static updateUser(req, res, next) {
    try {
      const updated = UserService.updateUser(req.workspaceId, req.params.id, req.body);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static changeRole(req, res, next) {
    try {
      const updated = UserService.changeRole(req.workspaceId, req.params.id, req.body.role, req.user.id);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static toggleStatus(req, res, next) {
    try {
      const updated = UserService.toggleStatus(req.workspaceId, req.params.id, req.body.is_active, req.user.id);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async issueTemporaryPassword(req, res, next) {
    try {
      const result = await UserService.issueTemporaryPassword(req.workspaceId, req.params.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

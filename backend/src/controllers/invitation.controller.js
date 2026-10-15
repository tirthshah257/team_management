import { InvitationService } from '../services/invitation.service.js';
import { config } from '../config/env.js';
import { CSRF_COOKIE_NAME } from '../middleware/csrf.js';

const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000;

export class InvitationController {
  static create(req, res, next) {
    try {
      const result = InvitationService.createInvitation(req.workspaceId, req.user, req.body);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static list(req, res, next) {
    try {
      const invitations = InvitationService.listInvitations(req.workspaceId, {
        status: req.query.status
      });
      res.json({ data: invitations });
    } catch (err) {
      next(err);
    }
  }

  static revoke(req, res, next) {
    try {
      const result = InvitationService.revokeInvitation(req.workspaceId, req.params.id, req.user);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static regenerate(req, res, next) {
    try {
      const result = InvitationService.regenerateInvitation(req.workspaceId, req.params.id, req.user);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static validate(req, res, next) {
    try {
      const result = InvitationService.validateToken(req.query.token);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async accept(req, res, next) {
    try {
      const { user, workspace, token, csrfToken } = await InvitationService.acceptInvitation(
        req.query.token,
        req.body
      );

      // Set auth cookies for the newly joined user
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/'
      });

      res.cookie(CSRF_COOKIE_NAME, csrfToken, {
        httpOnly: false,
        secure: config.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/'
      });

      res.status(201).json({
        data: {
          user,
          workspace
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async onboard(req, res, next) {
    try {
      const result = await InvitationService.onboardInvitation(
        req.workspaceId,
        Number(req.params.id),
        req.user,
        req.body
      );
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async directOnboard(req, res, next) {
    try {
      const result = await InvitationService.directOnboardMember(
        req.workspaceId,
        req.user,
        req.body
      );
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

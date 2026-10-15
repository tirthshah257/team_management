import { AuthService } from '../services/auth.service.js';
import { config } from '../config/env.js';
import { CSRF_COOKIE_NAME } from '../middleware/csrf.js';

const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours

function setAuthCookies(res, token, csrfToken) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });

  if (csrfToken) {
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: config.COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/'
    });
  }
}

function clearAuthCookies(res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/'
  });
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/'
  });
}

export class AuthController {
  static getStatus(req, res, next) {
    try {
      const status = AuthService.getRegistrationStatus();
      res.json({ data: status });
    } catch (err) {
      next(err);
    }
  }

  static getMembers(req, res, next) {
    try {
      const members = AuthService.getSystemMembers();
      res.json({ data: members });
    } catch (err) {
      next(err);
    }
  }

  static async quickLogin(req, res, next) {
    try {
      const { user, workspace, token, csrfToken } = await AuthService.quickLogin(req.body);
      setAuthCookies(res, token, csrfToken);
      res.json({
        data: {
          user,
          workspace
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async register(req, res, next) {
    try {
      const { user, workspace, token, csrfToken } = await AuthService.registerFirstAdmin(req.body);
      setAuthCookies(res, token, csrfToken);
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

  static async login(req, res, next) {
    try {
      const { user, workspace, token, csrfToken } = await AuthService.login(req.body);
      setAuthCookies(res, token, csrfToken);
      res.json({
        data: {
          user,
          workspace
        }
      });
    } catch (err) {
      console.error('[AuthController.login error]:', err);
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      clearAuthCookies(res);
      res.json({
        data: {
          message: 'Logged out successfully'
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req, res, next) {
    try {
      const me = await AuthService.getMe(req.user.id);
      res.json({ data: me });
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const { newToken } = await AuthService.changePassword(req.user.id, req.body);
      setAuthCookies(res, newToken);
      res.json({
        data: {
          message: 'Password changed successfully'
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

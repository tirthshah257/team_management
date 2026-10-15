import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { verifyToken } from '../utils/security.js';
import { getDatabase } from '../db/connection.js';

export function authenticate(req, res, next) {
  // Extract token from cookie (primary) or Bearer header (testing/api)
  let token = req.cookies?.token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const decoded = verifyToken(token);
    const db = getDatabase();

    const user = db.prepare(`
      SELECT id, workspace_id, name, email, role, avatar_color, capacity_hours_per_week,
             is_active, must_change_password, token_version
      FROM users
      WHERE id = ?
    `).get(decoded.id);

    if (!user) {
      return next(new UnauthorizedError('User account not found'));
    }

    if (!user.is_active) {
      return next(new UnauthorizedError('User account has been deactivated'));
    }

    if (user.token_version !== decoded.token_version) {
      return next(new UnauthorizedError('Session has expired or been revoked'));
    }

    // Attach user to request
    req.user = user;
    req.workspaceId = user.workspace_id;

    // If user must change password, restrict endpoints except password change, me, and logout
    if (user.must_change_password) {
      const fullPath = (req.originalUrl || req.path || '').split('?')[0];
      const isAllowed =
        fullPath.endsWith('/auth/change-password') ||
        fullPath.endsWith('/auth/logout') ||
        fullPath.endsWith('/auth/me') ||
        req.path === '/change-password' ||
        req.path === '/logout' ||
        req.path === '/me';

      if (!isAllowed) {
        return next(new ForbiddenError('You must change your password before continuing'));
      }
    }

    next();
  } catch (err) {
    return next(new UnauthorizedError('Invalid or expired authentication token'));
  }
}

export { requireRole, requireAdmin, requireManagerOrAdmin } from './rbac.js';


import { ForbiddenError } from '../utils/errors.js';
import { generateCsrfToken } from '../utils/security.js';
import { config } from '../config/env.js';

export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function csrfProtection(req, res, next) {
  // Safe HTTP methods do not change state
  const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);

  // If client doesn't have a CSRF cookie yet, issue one
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/'
    });
  }

  if (isSafeMethod) {
    return next();
  }

  // Exempt public auth endpoints that don't yet have authenticated cookies
  const publicExemptions = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/invitations/accept'
  ];

  if (publicExemptions.includes(req.path)) {
    return next();
  }

  // Only enforce CSRF if authenticated via cookie
  if (req.cookies?.token) {
    const headerToken = req.headers[CSRF_HEADER_NAME] || req.headers[CSRF_HEADER_NAME.toLowerCase()];
    const cookieToken = req.cookies[CSRF_COOKIE_NAME];

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      return next(new ForbiddenError('Invalid or missing CSRF token'));
    }
  }

  next();
}

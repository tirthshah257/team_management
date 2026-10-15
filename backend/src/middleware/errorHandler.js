import { AppError } from '../utils/errors.js';
import { config } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Handle SQLite constraint errors gracefully
  if (err.code === 'SQLITE_CONSTRAINT' || err.message?.includes('UNIQUE constraint failed')) {
    statusCode = 409;
    code = 'CONFLICT';
    message = 'A record with these details already exists.';
  } else if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Data failed constraint validation.';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Authentication token is invalid or expired';
  }

  // Hide details and internal messages in production if not operational
  if (config.isProduction && !err.isOperational) {
    statusCode = 500;
    code = 'INTERNAL_ERROR';
    message = 'Internal server error';
    details = null;
  }

  if (!config.isTest && statusCode >= 500) {
    console.error('[ServerError]', err);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  });
}

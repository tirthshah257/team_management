import { ValidationError } from '../utils/errors.js';

export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      if (err.errors) {
        const details = {};
        for (const e of err.errors) {
          const path = e.path.join('.') || 'root';
          details[path] = e.message;
        }
        return next(new ValidationError('Input validation failed', details));
      }
      next(err);
    }
  };
}

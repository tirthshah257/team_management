import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/auth.validators.js';
import { config } from '../config/env.js';

const router = Router();

// Rate limiter for auth endpoints (only strictly applied in production)
const authLimiter = config.isProduction ? rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again in 15 minutes.'
    }
  }
}) : (req, res, next) => next();

router.get('/status', AuthController.getStatus);
router.get('/members', AuthController.getMembers);
router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/quick-login', AuthController.quickLogin);
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.getMe);
router.post('/change-password', authenticate, validate(changePasswordSchema), AuthController.changePassword);

export default router;

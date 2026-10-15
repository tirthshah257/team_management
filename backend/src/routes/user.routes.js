import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  updateProfileSchema,
  updatePreferencesSchema,
  updateUserSchema,
  changeRoleSchema,
  toggleStatusSchema
} from '../validators/user.validators.js';

const router = Router();

router.use(authenticate);

// Profile and preferences routes
router.patch('/me', validate(updateProfileSchema), UserController.updateProfile);
router.get('/me/preferences', UserController.getPreferences);
router.patch('/me/preferences', validate(updatePreferencesSchema), UserController.updatePreferences);

// User listings and details
router.get('/', UserController.list);
router.get('/:id', UserController.getById);

// Admin-only user management
router.patch('/:id', requireAdmin, validate(updateUserSchema), UserController.updateUser);
router.patch('/:id/role', requireAdmin, validate(changeRoleSchema), UserController.changeRole);
router.patch('/:id/status', requireAdmin, validate(toggleStatusSchema), UserController.toggleStatus);
router.post('/:id/temporary-password', requireAdmin, UserController.issueTemporaryPassword);

export default router;

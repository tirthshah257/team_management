import { Router } from 'express';
import { InvitationController } from '../controllers/invitation.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireManagerOrAdmin } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  createInvitationSchema,
  acceptInvitationSchema,
  validateInvitationTokenSchema
} from '../validators/invitation.validators.js';

const router = Router();

// Public invitation endpoints
router.get('/validate', validate(validateInvitationTokenSchema), InvitationController.validate);
router.post('/accept', validate(acceptInvitationSchema), InvitationController.accept);

// Authenticated endpoints (Admin or Manager)
router.post('/', authenticate, requireManagerOrAdmin, validate(createInvitationSchema), InvitationController.create);
router.get('/', authenticate, requireManagerOrAdmin, InvitationController.list);
router.post('/direct-onboard', authenticate, requireManagerOrAdmin, InvitationController.directOnboard);
router.post('/:id/onboard', authenticate, requireManagerOrAdmin, InvitationController.onboard);
router.post('/:id/revoke', authenticate, requireManagerOrAdmin, InvitationController.revoke);
router.post('/:id/regenerate', authenticate, requireManagerOrAdmin, InvitationController.regenerate);

export default router;

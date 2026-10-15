import { Router } from 'express';
import { TeamController } from '../controllers/team.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireManagerOrAdmin } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema
} from '../validators/team.validators.js';

const router = Router();

router.use(authenticate);

router.get('/', TeamController.list);
router.post('/', requireManagerOrAdmin, validate(createTeamSchema), TeamController.create);
router.get('/:id', TeamController.getById);
router.patch('/:id', validate(updateTeamSchema), TeamController.update);
router.delete('/:id', TeamController.delete);

router.post('/:id/members', validate(addTeamMemberSchema), TeamController.addMember);
router.delete('/:id/members/:userId', TeamController.removeMember);

export default router;

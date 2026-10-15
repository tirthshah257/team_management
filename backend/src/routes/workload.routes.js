import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireManagerOrAdmin } from '../middleware/rbac.js';
import { getWorkload, reassignTask } from '../controllers/planning.controller.js';

const router = express.Router();

router.use(authenticate, requireManagerOrAdmin);

router.get('/', getWorkload);
router.post('/tasks/:id/reassign', reassignTask);

export default router;

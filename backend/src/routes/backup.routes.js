import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import {
  listBackups,
  triggerBackup,
  downloadBackup
} from '../controllers/backup.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/', listBackups);
router.post('/', triggerBackup);
router.get('/:id/download', downloadBackup);

export default router;

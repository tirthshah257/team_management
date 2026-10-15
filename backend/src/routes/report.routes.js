import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireManagerOrAdmin } from '../middleware/rbac.js';
import {
  getProgressReport,
  getProductivityReport,
  getTimeSpentReport,
  exportCsv
} from '../controllers/report.controller.js';

const router = express.Router();

router.use(authenticate, requireManagerOrAdmin);

router.get('/progress', getProgressReport);
router.get('/productivity', getProductivityReport);
router.get('/time-spent', getTimeSpentReport);
router.get('/export.csv', exportCsv);

export default router;

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getActiveTimer,
  startTimer,
  stopTimer,
  listTimeEntries,
  createManualEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getTimesheets
} from '../controllers/time.controller.js';

const router = express.Router();

router.use(authenticate);

// Timer endpoints
router.get('/active', getActiveTimer);
router.post('/tasks/:id/start', startTimer);
router.post('/tasks/:id/stop', stopTimer);

// Time entries & Timesheet grid
router.get('/', listTimeEntries);
router.post('/', createManualEntry);
router.patch('/:id', updateTimeEntry);
router.delete('/:id', deleteTimeEntry);
router.get('/timesheets', getTimesheets);

export default router;

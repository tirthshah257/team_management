import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getAttendanceStatus,
  checkIn,
  checkOut,
  listAttendance
} from '../controllers/people.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/status', getAttendanceStatus);
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/', listAttendance);

export default router;

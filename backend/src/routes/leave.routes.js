import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getLeaveBalances,
  adjustLeaveBalance,
  listLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest
} from '../controllers/people.controller.js';

const router = express.Router();

router.use(authenticate);

// Leave balances
router.get('/balances', getLeaveBalances);
router.patch('/balances/:id', adjustLeaveBalance);

// Leave requests
router.get('/requests', listLeaveRequests);
router.post('/requests', createLeaveRequest);
router.patch('/requests/:id/approve', approveLeaveRequest);
router.patch('/requests/:id/reject', rejectLeaveRequest);
router.patch('/requests/:id/cancel', cancelLeaveRequest);

export default router;

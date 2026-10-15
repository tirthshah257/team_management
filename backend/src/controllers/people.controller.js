import { AttendanceService } from '../services/attendance.service.js';
import { LeaveService } from '../services/leave.service.js';
import { PerformanceService } from '../services/performance.service.js';
import {
  createLeaveRequestSchema,
  reviewLeaveRequestSchema,
  adjustLeaveBalanceSchema,
  performanceReviewSchema
} from '../validators/people.validators.js';

const attendanceService = new AttendanceService();
const leaveService = new LeaveService();
const performanceService = new PerformanceService();

// Attendance
export async function getAttendanceStatus(req, res, next) {
  try {
    const status = attendanceService.getStatus(req.user.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
}

export async function checkIn(req, res, next) {
  try {
    const session = attendanceService.checkIn(req.user.id, req.user.workspace_id);
    res.status(201).json({ session, message: 'Checked in successfully' });
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req, res, next) {
  try {
    const session = attendanceService.checkOut(req.user.id);
    res.json({ session, message: 'Checked out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function listAttendance(req, res, next) {
  try {
    const { from, to, userId, targetUserId, all } = req.query;
    const requestedTargetId = (userId || targetUserId) ? Number(userId || targetUserId) : undefined;
    const logs = attendanceService.listAttendance({
      workspaceId: req.user.workspace_id,
      user: req.user,
      from,
      to,
      targetUserId: requestedTargetId,
      allMembers: all === 'true'
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
}

// Leave
export async function getLeaveBalances(req, res, next) {
  try {
    const { userId, year } = req.query;
    const queryUserId = (req.user.role === 'admin' || req.user.role === 'manager') && userId ? Number(userId) : req.user.id;
    const balances = leaveService.getBalances(queryUserId, req.user.workspace_id, year ? Number(year) : undefined);
    res.json({ balances });
  } catch (err) {
    next(err);
  }
}

export async function adjustLeaveBalance(req, res, next) {
  try {
    const validated = adjustLeaveBalanceSchema.parse(req.body);
    const balance = leaveService.adjustBalance(Number(req.params.id), req.user, {
      adjustmentDays: validated.adjustment_days,
      adjustmentReason: validated.adjustment_reason
    });
    res.json({ balance, message: 'Leave balance adjusted' });
  } catch (err) {
    next(err);
  }
}

export async function listLeaveRequests(req, res, next) {
  try {
    const { status, userId } = req.query;
    const requests = leaveService.listRequests({
      workspaceId: req.user.workspace_id,
      user: req.user,
      status,
      targetUserId: userId ? Number(userId) : undefined
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

export async function createLeaveRequest(req, res, next) {
  try {
    const validated = createLeaveRequestSchema.parse(req.body);
    const request = leaveService.createRequest({
      workspaceId: req.user.workspace_id,
      user: req.user,
      data: validated
    });
    res.status(201).json({ request, message: 'Leave request submitted' });
  } catch (err) {
    next(err);
  }
}

export async function approveLeaveRequest(req, res, next) {
  try {
    const request = leaveService.approveRequest(Number(req.params.id), req.user);
    res.json({ request, message: 'Leave request approved' });
  } catch (err) {
    next(err);
  }
}

export async function rejectLeaveRequest(req, res, next) {
  try {
    const validated = reviewLeaveRequestSchema.parse(req.body);
    const request = leaveService.rejectRequest(Number(req.params.id), req.user, {
      reviewNote: validated.review_note
    });
    res.json({ request, message: 'Leave request rejected' });
  } catch (err) {
    next(err);
  }
}

export async function cancelLeaveRequest(req, res, next) {
  try {
    const result = leaveService.cancelRequest(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Performance
export async function getPerformance(req, res, next) {
  try {
    const { month, userId } = req.query;
    const result = performanceService.getMetrics({
      workspaceId: req.user.workspace_id,
      user: req.user,
      month,
      targetUserId: userId ? Number(userId) : undefined
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function savePerformanceReview(req, res, next) {
  try {
    const validated = performanceReviewSchema.parse(req.body);
    const result = performanceService.saveReview({
      workspaceId: req.user.workspace_id,
      reviewer: req.user,
      data: validated
    });
    res.json({ result, message: 'Review note saved successfully' });
  } catch (err) {
    next(err);
  }
}

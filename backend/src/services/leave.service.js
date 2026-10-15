import { getDatabase } from '../db/connection.js';
import { NotificationService } from './notification.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

export class LeaveService {
  constructor(db) {
    this.db = db || getDatabase();
    this.notificationService = new NotificationService(this.db);
  }

  getBalances(userId, workspaceId, year = new Date().getFullYear()) {
    return this.db.prepare(`
      SELECT lb.*,
        (
          SELECT COALESCE(SUM(lr.days), 0)
          FROM leave_requests lr
          WHERE lr.user_id = lb.user_id AND lr.leave_type = lb.leave_type
            AND lr.status = 'approved' AND strftime('%Y', lr.start_date) = ?
        ) as used_days
      FROM leave_balances lb
      WHERE lb.user_id = ? AND lb.year = ?
    `).all(String(year), userId, year);
  }

  adjustBalance(balanceId, user, { adjustmentDays, adjustmentReason }) {
    if (user.role === 'member') {
      throw new ForbiddenError('Only Admins and Managers can adjust leave balances');
    }

    const balance = this.db.prepare('SELECT * FROM leave_balances WHERE id = ?').get(balanceId);
    if (!balance) throw new NotFoundError('Leave balance record not found');

    this.db.prepare(`
      UPDATE leave_balances
      SET adjustment_days = adjustment_days + ?,
          adjustment_reason = ?,
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(adjustmentDays, adjustmentReason, balanceId);

    return this.db.prepare('SELECT * FROM leave_balances WHERE id = ?').get(balanceId);
  }

  listRequests({ workspaceId, user, status, targetUserId }) {
    const wsId = workspaceId || user.workspace_id;

    let query = `
      SELECT lr.*,
        u.name as user_name,
        u.email as user_email,
        u.avatar_color as user_avatar_color,
        u.role as user_role,
        rev.name as reviewer_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      LEFT JOIN users rev ON lr.reviewed_by = rev.id
      WHERE lr.workspace_id = ?
    `;
    const params = [wsId];

    if (user.role === 'member') {
      query += ' AND lr.user_id = ?';
      params.push(user.id);
    } else if (targetUserId) {
      query += ' AND lr.user_id = ?';
      params.push(targetUserId);
    }

    if (status) {
      query += ' AND lr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY lr.created_at DESC LIMIT 100';
    return this.db.prepare(query).all(...params);
  }

  createRequest({ workspaceId, user, data }) {
    const wsId = workspaceId || user.workspace_id;
    const year = new Date(data.start_date).getFullYear();

    // Check balance
    const balance = this.db.prepare(`
      SELECT allocated_days, adjustment_days FROM leave_balances
      WHERE user_id = ? AND leave_type = ? AND year = ?
    `).get(user.id, data.leave_type, year);

    const totalAllowed = (balance?.allocated_days || 0) + (balance?.adjustment_days || 0);

    const usedRow = this.db.prepare(`
      SELECT COALESCE(SUM(days), 0) as used
      FROM leave_requests
      WHERE user_id = ? AND leave_type = ? AND status = 'approved' AND strftime('%Y', start_date) = ?
    `).get(user.id, data.leave_type, String(year));

    const remaining = totalAllowed - (usedRow?.used || 0);
    if (data.days > remaining) {
      throw new ValidationError(`Insufficient leave balance. Remaining: ${remaining} days, Requested: ${data.days} days.`);
    }

    const res = this.db.prepare(`
      INSERT INTO leave_requests (
        workspace_id, user_id, leave_type, start_date, end_date, days, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      wsId,
      user.id,
      data.leave_type,
      data.start_date,
      data.end_date,
      data.days,
      data.reason || null
    );

    const requestId = res.lastInsertRowid;

    // Notify workspace admins & managers
    const managers = this.db.prepare(`
      SELECT id FROM users
      WHERE workspace_id = ? AND role IN ('admin', 'manager') AND id != ?
    `).all(wsId, user.id);

    for (const m of managers) {
      this.notificationService.notify({
        workspaceId: wsId,
        recipientId: m.id,
        actorId: user.id,
        type: 'leave_requested',
        title: `${user.name} requested leave`,
        message: `${data.days} day(s) of ${data.leave_type} leave from ${data.start_date} to ${data.end_date}`,
        entityType: 'leave_request',
        entityId: requestId
      });
    }

    return this.db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId);
  }

  approveRequest(requestId, user, workspaceId) {
    if (user.role === 'member') {
      throw new ForbiddenError('Only Admins and Managers can approve leave requests');
    }

    const wsId = workspaceId || user.workspace_id;
    const request = this.db.prepare('SELECT * FROM leave_requests WHERE id = ? AND workspace_id = ?').get(requestId, wsId);
    if (!request) throw new NotFoundError('Leave request not found');

    // Invariant: User can never approve their own leave request
    if (request.user_id === user.id) {
      throw new ForbiddenError('You cannot approve your own leave request');
    }

    if (request.status !== 'pending') {
      throw new ValidationError(`Cannot approve request that is already ${request.status}`);
    }

    this.db.prepare(`
      UPDATE leave_requests
      SET status = 'approved',
          reviewed_by = ?,
          reviewed_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(user.id, requestId);

    // Notify requester
    this.notificationService.notify({
      workspaceId: wsId,
      recipientId: request.user_id,
      actorId: user.id,
      type: 'leave_decided',
      title: 'Your leave request was approved',
      message: `${user.name} approved your ${request.days} day(s) ${request.leave_type} leave`,
      entityType: 'leave_request',
      entityId: requestId
    });

    return this.db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId);
  }

  rejectRequest(requestId, user, { reviewNote }, workspaceId) {
    if (user.role === 'member') {
      throw new ForbiddenError('Only Admins and Managers can reject leave requests');
    }

    const wsId = workspaceId || user.workspace_id;
    const request = this.db.prepare('SELECT * FROM leave_requests WHERE id = ? AND workspace_id = ?').get(requestId, wsId);
    if (!request) throw new NotFoundError('Leave request not found');

    if (request.user_id === user.id) {
      throw new ForbiddenError('You cannot reject your own leave request');
    }

    if (request.status !== 'pending') {
      throw new ValidationError(`Cannot reject request that is already ${request.status}`);
    }

    this.db.prepare(`
      UPDATE leave_requests
      SET status = 'rejected',
          reviewed_by = ?,
          review_note = ?,
          reviewed_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(user.id, reviewNote || null, requestId);

    // Notify requester
    this.notificationService.notify({
      workspaceId: wsId,
      recipientId: request.user_id,
      actorId: user.id,
      type: 'leave_decided',
      title: 'Your leave request was rejected',
      message: reviewNote ? `Note: ${reviewNote}` : 'Your leave request was declined',
      entityType: 'leave_request',
      entityId: requestId
    });

    return this.db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId);
  }

  cancelRequest(requestId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const request = this.db.prepare('SELECT * FROM leave_requests WHERE id = ? AND workspace_id = ?').get(requestId, wsId);
    if (!request) throw new NotFoundError('Leave request not found');

    if (request.user_id !== user.id && user.role !== 'admin') {
      throw new ForbiddenError('You can only cancel your own pending leave requests');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Only pending leave requests can be cancelled');
    }

    this.db.prepare(`
      UPDATE leave_requests
      SET status = 'cancelled', updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(requestId);

    return { message: 'Leave request cancelled successfully' };
  }
}

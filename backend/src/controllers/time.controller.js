import { TimeService } from '../services/time.service.js';
import { createManualTimeEntrySchema, updateTimeEntrySchema } from '../validators/time.validators.js';

const timeService = new TimeService();

export async function getActiveTimer(req, res, next) {
  try {
    const timer = timeService.getActiveTimer(req.user.id);
    res.json({ timer: timer || null });
  } catch (err) {
    next(err);
  }
}

export async function startTimer(req, res, next) {
  try {
    const timer = timeService.startTimer(Number(req.params.id), req.user);
    res.status(201).json({ timer, message: 'Timer started' });
  } catch (err) {
    next(err);
  }
}

export async function stopTimer(req, res, next) {
  try {
    const entry = timeService.stopTimer(Number(req.params.id), req.user);
    res.json({ entry, message: 'Timer stopped' });
  } catch (err) {
    next(err);
  }
}

export async function listTimeEntries(req, res, next) {
  try {
    const { from, to, taskId, projectId, userId } = req.query;
    const entries = timeService.listTimeEntries({
      workspaceId: req.user.workspace_id,
      user: req.user,
      from,
      to,
      taskId: taskId ? Number(taskId) : undefined,
      projectId: projectId ? Number(projectId) : undefined,
      targetUserId: userId ? Number(userId) : undefined
    });
    res.json({ entries });
  } catch (err) {
    next(err);
  }
}

export async function createManualEntry(req, res, next) {
  try {
    const validated = createManualTimeEntrySchema.parse(req.body);
    const entry = timeService.createManualEntry({
      workspaceId: req.user.workspace_id,
      user: req.user,
      data: validated
    });
    res.status(201).json({ entry, message: 'Time logged successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateTimeEntry(req, res, next) {
  try {
    const validated = updateTimeEntrySchema.parse(req.body);
    const entry = timeService.updateTimeEntry(Number(req.params.id), req.user, validated);
    res.json({ entry, message: 'Time entry updated' });
  } catch (err) {
    next(err);
  }
}

export async function deleteTimeEntry(req, res, next) {
  try {
    const result = timeService.deleteTimeEntry(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTimesheets(req, res, next) {
  try {
    const { from, to, userId } = req.query;
    const result = timeService.getTimesheetGrid({
      workspaceId: req.user.workspace_id,
      user: req.user,
      from,
      to,
      targetUserId: userId ? Number(userId) : undefined
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

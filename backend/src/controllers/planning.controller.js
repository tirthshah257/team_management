import { CalendarService } from '../services/calendar.service.js';
import { WorkloadService } from '../services/workload.service.js';

const calendarService = new CalendarService();
const workloadService = new WorkloadService();

export async function getCalendarEvents(req, res, next) {
  try {
    const { from, to } = req.query;
    const result = calendarService.getEvents({
      workspaceId: req.user.workspace_id,
      user: req.user,
      from,
      to
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getWorkload(req, res, next) {
  try {
    const { from, to, teamId } = req.query;
    const result = workloadService.getWorkload({
      workspaceId: req.user.workspace_id,
      user: req.user,
      from,
      to,
      teamId: teamId ? Number(teamId) : undefined
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reassignTask(req, res, next) {
  try {
    const { from_user_id, to_user_id } = req.body;
    const task = workloadService.reassignTask({
      taskId: Number(req.params.id),
      fromUserId: from_user_id ? Number(from_user_id) : null,
      toUserId: Number(to_user_id),
      user: req.user
    });
    res.json({ task, message: 'Task reassigned successfully' });
  } catch (err) {
    next(err);
  }
}

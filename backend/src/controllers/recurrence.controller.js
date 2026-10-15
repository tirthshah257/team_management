import { RecurrenceService } from '../services/recurrence.service.js';
import { recurrenceRuleSchema } from '../validators/recurrence.validators.js';

const recurrenceService = new RecurrenceService();

export async function setTaskRecurrence(req, res, next) {
  try {
    const validated = recurrenceRuleSchema.parse(req.body);
    const rule = recurrenceService.setTaskRecurrence(Number(req.params.id), req.user, validated);
    res.status(201).json({ rule, message: 'Recurrence rule set successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteRecurrenceRule(req, res, next) {
  try {
    const result = recurrenceService.deleteRecurrenceRule(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

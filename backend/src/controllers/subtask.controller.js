import { SubtaskService } from '../services/subtask.service.js';
import { createSubtaskSchema, updateSubtaskSchema } from '../validators/task.validators.js';

const subtaskService = new SubtaskService();

export async function listSubtasks(req, res, next) {
  try {
    const subtasks = subtaskService.listSubtasks(Number(req.params.taskId), req.user);
    res.json({ subtasks });
  } catch (err) {
    next(err);
  }
}

export async function createSubtask(req, res, next) {
  try {
    const validated = createSubtaskSchema.parse(req.body);
    const subtask = subtaskService.createSubtask(Number(req.params.taskId), req.user, validated);
    res.status(201).json({ subtask, message: 'Subtask created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateSubtask(req, res, next) {
  try {
    const validated = updateSubtaskSchema.parse(req.body);
    const subtask = subtaskService.updateSubtask(Number(req.params.id), req.user, validated);
    res.json({ subtask, message: 'Subtask updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteSubtask(req, res, next) {
  try {
    const result = subtaskService.deleteSubtask(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

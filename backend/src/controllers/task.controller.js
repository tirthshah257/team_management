import { TaskService } from '../services/task.service.js';
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  taskAssigneeSchema,
  setTaskLabelsSchema
} from '../validators/task.validators.js';

const taskService = new TaskService();

export async function listProjectTasks(req, res, next) {
  try {
    const { status, priority, assigneeId, labelId, search, due } = req.query;
    const tasks = taskService.listProjectTasks({
      projectId: Number(req.params.projectId),
      user: req.user,
      status,
      priority,
      assigneeId: assigneeId ? Number(assigneeId) : undefined,
      labelId: labelId ? Number(labelId) : undefined,
      search,
      due
    });
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
}

export async function getMyTasks(req, res, next) {
  try {
    const result = taskService.getMyTasks(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTasksForLogging(req, res, next) {
  try {
    const targetUserId = req.query.userId ? Number(req.query.userId) : undefined;
    const tasks = taskService.listTasksForLogging(req.user, undefined, targetUserId);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
}

export async function getTask(req, res, next) {
  try {
    const task = taskService.getTask(Number(req.params.id), req.user);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function createTask(req, res, next) {
  try {
    const validated = createTaskSchema.parse(req.body);
    const task = taskService.createTask({
      projectId: Number(req.params.projectId),
      user: req.user,
      data: validated
    });
    res.status(201).json({ task, message: 'Task created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req, res, next) {
  try {
    const validated = updateTaskSchema.parse(req.body);
    const task = taskService.updateTask({
      taskId: Number(req.params.id),
      user: req.user,
      data: validated
    });
    res.json({ task, message: 'Task updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function moveTask(req, res, next) {
  try {
    const validated = moveTaskSchema.parse(req.body);
    const task = taskService.moveTask({
      taskId: Number(req.params.id),
      user: req.user,
      data: validated
    });
    res.json({ task, message: 'Task moved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req, res, next) {
  try {
    const result = taskService.softDeleteTask(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function restoreTask(req, res, next) {
  try {
    const task = taskService.restoreTask(Number(req.params.id), req.user);
    res.json({ task, message: 'Task restored successfully' });
  } catch (err) {
    next(err);
  }
}

export async function addAssignee(req, res, next) {
  try {
    const validated = taskAssigneeSchema.parse(req.body);
    const task = taskService.addAssignee(Number(req.params.id), validated.user_id, req.user);
    res.status(201).json({ task, message: 'Assignee added successfully' });
  } catch (err) {
    next(err);
  }
}

export async function removeAssignee(req, res, next) {
  try {
    const task = taskService.removeAssignee(Number(req.params.id), Number(req.params.userId), req.user);
    res.json({ task, message: 'Assignee removed successfully' });
  } catch (err) {
    next(err);
  }
}

export async function setTaskLabels(req, res, next) {
  try {
    const validated = setTaskLabelsSchema.parse(req.body);
    const task = taskService.setTaskLabels(Number(req.params.id), validated.label_ids, req.user);
    res.json({ task, message: 'Labels updated successfully' });
  } catch (err) {
    next(err);
  }
}

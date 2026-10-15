import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getMyTasks,
  getTasksForLogging,
  getTask,
  updateTask,
  moveTask,
  deleteTask,
  restoreTask,
  addAssignee,
  removeAssignee,
  setTaskLabels
} from '../controllers/task.controller.js';
import { setTaskRecurrence } from '../controllers/recurrence.controller.js';
import { listSubtasks, createSubtask } from '../controllers/subtask.controller.js';
import { listComments, createComment } from '../controllers/comment.controller.js';

const router = express.Router();

router.use(authenticate);

// Special routes first
router.get('/my', getMyTasks);
router.get('/for-logging', getTasksForLogging);

// Task detail & operations
router.get('/:id', getTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/restore', restoreTask);
router.patch('/:id/move', moveTask);

// Assignees & Labels
router.post('/:id/assignees', addAssignee);
router.delete('/:id/assignees/:userId', removeAssignee);
router.put('/:id/labels', setTaskLabels);

// Recurrence
router.post('/:id/recurrence', setTaskRecurrence);

// Subtasks
router.get('/:taskId/subtasks', listSubtasks);
router.post('/:taskId/subtasks', createSubtask);

// Comments on task
router.get('/:id/comments', listComments);
router.post('/:id/comments', createComment);

export default router;

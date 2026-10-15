import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { updateSubtask, deleteSubtask } from '../controllers/subtask.controller.js';

const router = express.Router();

router.use(authenticate);

router.patch('/:id', updateSubtask);
router.delete('/:id', deleteSubtask);

export default router;

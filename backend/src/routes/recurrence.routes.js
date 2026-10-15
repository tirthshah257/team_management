import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { deleteRecurrenceRule } from '../controllers/recurrence.controller.js';

const router = express.Router();

router.use(authenticate);

router.delete('/:id', deleteRecurrenceRule);

export default router;

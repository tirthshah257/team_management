import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getCalendarEvents } from '../controllers/planning.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getCalendarEvents);

export default router;

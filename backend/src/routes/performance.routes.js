import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getPerformance,
  savePerformanceReview
} from '../controllers/people.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getPerformance);
router.post('/reviews', savePerformanceReview);

export default router;

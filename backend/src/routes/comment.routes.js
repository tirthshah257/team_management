import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  updateComment,
  deleteComment
} from '../controllers/comment.controller.js';

const router = express.Router();

router.use(authenticate);

router.patch('/:id', updateComment);
router.delete('/:id', deleteComment);

export default router;

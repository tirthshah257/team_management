import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { listLabels, createLabel, updateLabel, deleteLabel } from '../controllers/label.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listLabels);
router.post('/', createLabel);
router.patch('/:id', updateLabel);
router.delete('/:id', deleteLabel);

export default router;

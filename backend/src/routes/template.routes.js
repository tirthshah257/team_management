import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listTemplates,
  getTemplate,
  createProjectFromTemplate,
  deleteTemplate
} from '../controllers/template.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listTemplates);
router.get('/:id', getTemplate);
router.post('/:id/create-project', createProjectFromTemplate);
router.delete('/:id', deleteTemplate);

export default router;

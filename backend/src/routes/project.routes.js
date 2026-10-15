import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  addTeamMembers
} from '../controllers/project.controller.js';
import { listProjectTasks, createTask } from '../controllers/task.controller.js';
import { saveProjectAsTemplate } from '../controllers/template.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listProjects);
router.post('/', createProject);
router.get('/:id', getProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);

router.post('/:id/archive', archiveProject);
router.post('/:id/restore', restoreProject);
router.post('/:id/save-as-template', saveProjectAsTemplate);

router.get('/:id/members', listProjectMembers);
router.post('/:id/members', addProjectMember);
router.delete('/:id/members/:userId', removeProjectMember);
router.post('/:id/members/team/:teamId', addTeamMembers);

// Tasks under project
router.get('/:projectId/tasks', listProjectTasks);
router.post('/:projectId/tasks', createTask);

export default router;

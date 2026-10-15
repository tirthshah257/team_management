import { ProjectService } from '../services/project.service.js';
import { createProjectSchema, updateProjectSchema, addProjectMemberSchema } from '../validators/project.validators.js';

const projectService = new ProjectService();

export async function listProjects(req, res, next) {
  try {
    const { status, teamId, search, page, limit } = req.query;
    const result = projectService.listProjects({
      workspaceId: req.user.workspace_id,
      user: req.user,
      status,
      teamId: teamId ? Number(teamId) : undefined,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProject(req, res, next) {
  try {
    const project = projectService.getProject(Number(req.params.id), req.user);
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

export async function createProject(req, res, next) {
  try {
    const validated = createProjectSchema.parse(req.body);
    const project = projectService.createProject({
      workspaceId: req.user.workspace_id,
      user: req.user,
      data: validated
    });
    res.status(201).json({ project, message: 'Project created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req, res, next) {
  try {
    const validated = updateProjectSchema.parse(req.body);
    const project = projectService.updateProject({
      projectId: Number(req.params.id),
      user: req.user,
      data: validated
    });
    res.json({ project, message: 'Project updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function archiveProject(req, res, next) {
  try {
    const result = projectService.archiveProject(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function restoreProject(req, res, next) {
  try {
    const result = projectService.restoreProject(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req, res, next) {
  try {
    const result = projectService.deleteProject(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listProjectMembers(req, res, next) {
  try {
    const members = projectService.listMembers(Number(req.params.id), req.user);
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

export async function addProjectMember(req, res, next) {
  try {
    const validated = addProjectMemberSchema.parse(req.body);
    const members = projectService.addMember(Number(req.params.id), validated.user_id, req.user);
    res.status(201).json({ members, message: 'Member added to project' });
  } catch (err) {
    next(err);
  }
}

export async function removeProjectMember(req, res, next) {
  try {
    const members = projectService.removeMember(Number(req.params.id), Number(req.params.userId), req.user);
    res.json({ members, message: 'Member removed from project' });
  } catch (err) {
    next(err);
  }
}

export async function addTeamMembers(req, res, next) {
  try {
    const members = projectService.addTeamMembers(Number(req.params.id), Number(req.params.teamId), req.user);
    res.json({ members, message: 'Team members added to project' });
  } catch (err) {
    next(err);
  }
}

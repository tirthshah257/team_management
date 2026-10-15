import { TemplateService } from '../services/template.service.js';
import {
  saveProjectAsTemplateSchema,
  createProjectFromTemplateSchema
} from '../validators/template.validators.js';

const templateService = new TemplateService();

export async function listTemplates(req, res, next) {
  try {
    const templates = templateService.listTemplates(req.user.workspace_id);
    res.json({ templates });
  } catch (err) {
    next(err);
  }
}

export async function getTemplate(req, res, next) {
  try {
    const template = templateService.getTemplate(Number(req.params.id), req.user.workspace_id);
    res.json({ template });
  } catch (err) {
    next(err);
  }
}

export async function saveProjectAsTemplate(req, res, next) {
  try {
    const validated = saveProjectAsTemplateSchema.parse(req.body);
    const template = templateService.saveProjectAsTemplate({
      projectId: Number(req.params.id),
      user: req.user,
      data: validated
    });
    res.status(201).json({ template, message: 'Saved as template successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createProjectFromTemplate(req, res, next) {
  try {
    const validated = createProjectFromTemplateSchema.parse(req.body);
    const result = templateService.createProjectFromTemplate({
      templateId: Number(req.params.id),
      user: req.user,
      data: validated
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req, res, next) {
  try {
    const result = templateService.deleteTemplate(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

import { LabelService } from '../services/label.service.js';
import { labelSchema } from '../validators/task.validators.js';

const labelService = new LabelService();

export async function listLabels(req, res, next) {
  try {
    const labels = labelService.listLabels(req.user.workspace_id);
    res.json({ labels });
  } catch (err) {
    next(err);
  }
}

export async function createLabel(req, res, next) {
  try {
    const validated = labelSchema.parse(req.body);
    const label = labelService.createLabel(req.user.workspace_id, validated);
    res.status(201).json({ label, message: 'Label created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateLabel(req, res, next) {
  try {
    const validated = labelSchema.partial().parse(req.body);
    const label = labelService.updateLabel(Number(req.params.id), req.user.workspace_id, validated);
    res.json({ label, message: 'Label updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteLabel(req, res, next) {
  try {
    const result = labelService.deleteLabel(Number(req.params.id), req.user.workspace_id, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

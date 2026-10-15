import { getDatabase } from '../db/connection.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';

export class LabelService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  listLabels(workspaceId) {
    return this.db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM task_labels tl WHERE tl.label_id = l.id) as task_count
      FROM labels l
      WHERE l.workspace_id = ?
      ORDER BY l.name ASC
    `).all(workspaceId);
  }

  createLabel(workspaceId, { name, color }) {
    const existing = this.db.prepare(`
      SELECT id FROM labels WHERE workspace_id = ? AND name = ? COLLATE NOCASE
    `).get(workspaceId, name);

    if (existing) {
      throw new ConflictError(`Label "${name}" already exists in this workspace`);
    }

    const result = this.db.prepare(`
      INSERT INTO labels (workspace_id, name, color)
      VALUES (?, ?, ?)
    `).run(workspaceId, name, color || '#64748B');

    return this.db.prepare('SELECT * FROM labels WHERE id = ?').get(result.lastInsertRowid);
  }

  updateLabel(labelId, workspaceId, { name, color }) {
    const label = this.db.prepare('SELECT * FROM labels WHERE id = ? AND workspace_id = ?').get(labelId, workspaceId);
    if (!label) throw new NotFoundError('Label not found');

    if (name && name.toLowerCase() !== label.name.toLowerCase()) {
      const existing = this.db.prepare(`
        SELECT id FROM labels WHERE workspace_id = ? AND name = ? COLLATE NOCASE AND id != ?
      `).get(workspaceId, name, labelId);
      if (existing) {
        throw new ConflictError(`Label "${name}" already exists in this workspace`);
      }
    }

    const updates = [];
    const params = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }

    if (updates.length > 0) {
      params.push(labelId);
      this.db.prepare(`UPDATE labels SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    return this.db.prepare('SELECT * FROM labels WHERE id = ?').get(labelId);
  }

  deleteLabel(labelId, workspaceId, user) {
    if (user.role !== 'admin') {
      throw new ForbiddenError('Only Admins can delete labels');
    }

    const label = this.db.prepare('SELECT id FROM labels WHERE id = ? AND workspace_id = ?').get(labelId, workspaceId);
    if (!label) throw new NotFoundError('Label not found');

    this.db.prepare('DELETE FROM labels WHERE id = ?').run(labelId);
    return { message: 'Label deleted successfully' };
  }
}

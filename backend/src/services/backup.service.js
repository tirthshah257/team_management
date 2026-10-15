import path from 'path';
import fs from 'fs';
import { getDatabase } from '../db/connection.js';
import { config } from '../config/env.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export class BackupService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  listBackups(workspaceId) {
    return this.db.prepare(`
      SELECT b.*, u.name as created_by_name
      FROM backups b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.workspace_id = ?
      ORDER BY b.created_at DESC
    `).all(workspaceId);
  }

  async createBackup(workspaceId, user, trigger = 'manual') {
    if (user && user.role !== 'admin') {
      throw new ForbiddenError('Only Admins can trigger backups');
    }

    const backupDir = config.BACKUP_DIR;
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `teamflow-backup-${timestamp}.db`;
    const targetPath = path.join(backupDir, filename);

    try {
      // Use better-sqlite3 native backup API
      await this.db.backup(targetPath);
      const stat = fs.statSync(targetPath);

      const res = this.db.prepare(`
        INSERT INTO backups (workspace_id, filename, size_bytes, status, trigger, created_by)
        VALUES (?, ?, ?, 'success', ?, ?)
      `).run(workspaceId, filename, stat.size, trigger, user ? user.id : null);

      // Rotate old backups (keep latest N)
      this.rotateBackups(workspaceId, config.BACKUP_KEEP || 14);

      return this.db.prepare('SELECT * FROM backups WHERE id = ?').get(res.lastInsertRowid);
    } catch (err) {
      this.db.prepare(`
        INSERT INTO backups (workspace_id, filename, size_bytes, status, trigger, created_by)
        VALUES (?, ?, 0, 'failed', ?, ?)
      `).run(workspaceId, filename, trigger, user ? user.id : null);
      throw err;
    }
  }

  rotateBackups(workspaceId, keepCount) {
    const all = this.db.prepare(`
      SELECT id, filename FROM backups
      WHERE workspace_id = ? AND status = 'success'
      ORDER BY created_at DESC
    `).all(workspaceId);

    if (all.length > keepCount) {
      const toDelete = all.slice(keepCount);
      for (const b of toDelete) {
        const filePath = path.join(config.BACKUP_DIR, b.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        this.db.prepare('DELETE FROM backups WHERE id = ?').run(b.id);
      }
    }
  }

  getBackupFile(backupId, workspaceId) {
    const backup = this.db.prepare('SELECT * FROM backups WHERE id = ? AND workspace_id = ?').get(backupId, workspaceId);
    if (!backup) throw new NotFoundError('Backup not found');

    const filePath = path.join(config.BACKUP_DIR, backup.filename);
    if (!fs.existsSync(filePath)) throw new NotFoundError('Backup file not found on disk');

    return { backup, filePath };
  }
}

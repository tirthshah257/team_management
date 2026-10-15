import { BackupService } from '../services/backup.service.js';

const backupService = new BackupService();

export async function listBackups(req, res, next) {
  try {
    const backups = backupService.listBackups(req.user.workspace_id);
    res.json({ backups });
  } catch (err) {
    next(err);
  }
}

export async function triggerBackup(req, res, next) {
  try {
    const backup = await backupService.createBackup(req.user.workspace_id, req.user, 'manual');
    res.status(201).json({ backup, message: 'Backup created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function downloadBackup(req, res, next) {
  try {
    const { backup, filePath } = backupService.getBackupFile(Number(req.params.id), req.user.workspace_id);
    res.download(filePath, backup.filename);
  } catch (err) {
    next(err);
  }
}

import { NotificationService } from '../services/notification.service.js';
import { updateNotificationSettingsSchema } from '../validators/collaboration.validators.js';

const notificationService = new NotificationService();

export async function listNotifications(req, res, next) {
  try {
    const { page, limit, unreadOnly } = req.query;
    const result = notificationService.listNotifications(req.user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      unreadOnly: unreadOnly === 'true'
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const result = notificationService.getUnreadCount(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const result = notificationService.markAsRead(Number(req.params.id), req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const result = notificationService.markAllAsRead(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSettings(req, res, next) {
  try {
    const settings = notificationService.getSettings(req.user.id);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const validated = updateNotificationSettingsSchema.parse(req.body);
    const settings = notificationService.updateSettings(req.user.id, validated.settings);
    res.json({ settings, message: 'Notification settings updated' });
  } catch (err) {
    next(err);
  }
}

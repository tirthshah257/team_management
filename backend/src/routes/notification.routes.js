import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getSettings,
  updateSettings
} from '../controllers/notification.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markAsRead);
router.post('/read-all', markAllAsRead);

router.get('/settings', getSettings);
router.patch('/settings', updateSettings);

export default router;

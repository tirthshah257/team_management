import { apiClient } from './apiClient.js';

export const notificationService = {
  async listNotifications(params = {}) {
    const res = await apiClient.get('/notifications', { params });
    return res.data;
  },

  async getUnreadCount() {
    const res = await apiClient.get('/notifications/unread-count');
    return res.data.count;
  },

  async markAsRead(id) {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllAsRead() {
    const res = await apiClient.post('/notifications/read-all');
    return res.data;
  },

  async getSettings() {
    const res = await apiClient.get('/notifications/settings');
    return res.data.settings;
  },

  async updateSettings(settings) {
    const res = await apiClient.patch('/notifications/settings', { settings });
    return res.data.settings;
  }
};

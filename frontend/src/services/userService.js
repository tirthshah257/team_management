import { apiClient } from './apiClient.js';

export const userService = {
  async listUsers(params = {}) {
    const res = await apiClient.get('/users', { params });
    return res.data;
  },

  async getUser(id) {
    const res = await apiClient.get(`/users/${id}`);
    return res.data.data;
  },

  async updateProfile(data) {
    const res = await apiClient.patch('/users/me', data);
    return res.data.data;
  },

  async getPreferences() {
    const res = await apiClient.get('/users/me/preferences');
    return res.data.data;
  },

  async updatePreferences(data) {
    const res = await apiClient.patch('/users/me/preferences', data);
    return res.data.data;
  },

  async updateUser(id, data) {
    const res = await apiClient.patch(`/users/${id}`, data);
    return res.data.data;
  },

  async changeRole(id, role) {
    const res = await apiClient.patch(`/users/${id}/role`, { role });
    return res.data.data;
  },

  async toggleStatus(id, isActive) {
    const res = await apiClient.patch(`/users/${id}/status`, { is_active: isActive });
    return res.data.data;
  },

  async issueTemporaryPassword(id) {
    const res = await apiClient.post(`/users/${id}/temporary-password`);
    return res.data.data;
  }
};

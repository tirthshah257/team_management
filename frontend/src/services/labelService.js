import { apiClient } from './apiClient.js';

export const labelService = {
  async listLabels() {
    const res = await apiClient.get('/labels');
    return res.data.labels;
  },

  async createLabel(data) {
    const res = await apiClient.post('/labels', data);
    return res.data.label;
  },

  async updateLabel(id, data) {
    const res = await apiClient.patch(`/labels/${id}`, data);
    return res.data.label;
  },

  async deleteLabel(id) {
    const res = await apiClient.delete(`/labels/${id}`);
    return res.data;
  }
};

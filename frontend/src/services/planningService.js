import { apiClient } from './apiClient.js';

export const planningService = {
  async getCalendarEvents(from, to) {
    const res = await apiClient.get('/calendar', { params: { from, to } });
    return res.data.events;
  },

  async getWorkload(params = {}) {
    const res = await apiClient.get('/workload', { params });
    return res.data;
  },

  async reassignTask(taskId, data) {
    const res = await apiClient.post(`/workload/tasks/${taskId}/reassign`, data);
    return res.data;
  }
};

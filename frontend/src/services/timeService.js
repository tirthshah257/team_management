import { apiClient } from './apiClient.js';

export const timeService = {
  async getActiveTimer() {
    const res = await apiClient.get('/time-entries/active');
    return res.data.timer;
  },

  async startTimer(taskId) {
    const res = await apiClient.post(`/time-entries/tasks/${taskId}/start`);
    return res.data.timer;
  },

  async stopTimer(taskId) {
    const res = await apiClient.post(`/time-entries/tasks/${taskId}/stop`);
    return res.data.entry;
  },

  async listEntries(params = {}) {
    const res = await apiClient.get('/time-entries', { params });
    return res.data.entries;
  },

  async createManualEntry(data) {
    const res = await apiClient.post('/time-entries', data);
    return res.data.entry;
  },

  async updateEntry(id, data) {
    const res = await apiClient.patch(`/time-entries/${id}`, data);
    return res.data.entry;
  },

  async deleteEntry(id) {
    const res = await apiClient.delete(`/time-entries/${id}`);
    return res.data;
  },

  async getTimesheets(params = {}) {
    const res = await apiClient.get('/time-entries/timesheets', { params });
    return res.data;
  }
};

export const reportService = {
  async getProgressReport() {
    const res = await apiClient.get('/reports/progress');
    return res.data.report;
  },

  async getProductivityReport(params = {}) {
    const res = await apiClient.get('/reports/productivity', { params });
    return res.data.report;
  },

  async getTimeSpentReport(params = {}) {
    const res = await apiClient.get('/reports/time-spent', { params });
    return res.data.report;
  },

  getExportUrl(reportType = 'progress', from, to) {
    let url = `/api/v1/reports/export.csv?report=${reportType}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    return url;
  }
};

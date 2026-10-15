import { apiClient } from './apiClient.js';

export const attendanceService = {
  async getStatus() {
    const res = await apiClient.get('/attendance/status');
    return res.data;
  },

  async checkIn() {
    const res = await apiClient.post('/attendance/check-in');
    return res.data;
  },

  async checkOut() {
    const res = await apiClient.post('/attendance/check-out');
    return res.data;
  },

  async listLogs(params = {}) {
    const res = await apiClient.get('/attendance', { params });
    return res.data.logs;
  }
};

export const leaveService = {
  async getBalances(params = {}) {
    const res = await apiClient.get('/leave/balances', { params });
    return res.data.balances;
  },

  async adjustBalance(id, data) {
    const res = await apiClient.patch(`/leave/balances/${id}`, data);
    return res.data.balance;
  },

  async listRequests(params = {}) {
    const res = await apiClient.get('/leave/requests', { params });
    return res.data.requests;
  },

  async createRequest(data) {
    const res = await apiClient.post('/leave/requests', data);
    return res.data.request;
  },

  async approveRequest(id) {
    const res = await apiClient.patch(`/leave/requests/${id}/approve`);
    return res.data.request;
  },

  async rejectRequest(id, data = {}) {
    const res = await apiClient.patch(`/leave/requests/${id}/reject`, data);
    return res.data.request;
  },

  async cancelRequest(id) {
    const res = await apiClient.patch(`/leave/requests/${id}/cancel`);
    return res.data;
  }
};

export const performanceService = {
  async getMetrics(params = {}) {
    const res = await apiClient.get('/performance', { params });
    return res.data;
  },

  async saveReview(data) {
    const res = await apiClient.post('/performance/reviews', data);
    return res.data.result;
  }
};

export const backupService = {
  async listBackups() {
    const res = await apiClient.get('/backups');
    return res.data.backups;
  },

  async triggerBackup() {
    const res = await apiClient.post('/backups');
    return res.data.backup;
  },

  getDownloadUrl(id) {
    return `/api/v1/backups/${id}/download`;
  }
};

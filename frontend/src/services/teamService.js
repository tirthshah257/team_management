import { apiClient } from './apiClient.js';

export const teamService = {
  async listTeams() {
    const res = await apiClient.get('/teams');
    return res.data.data;
  },

  async getTeam(id) {
    const res = await apiClient.get(`/teams/${id}`);
    return res.data.data;
  },

  async createTeam(data) {
    const res = await apiClient.post('/teams', data);
    return res.data.data;
  },

  async updateTeam(id, data) {
    const res = await apiClient.patch(`/teams/${id}`, data);
    return res.data.data;
  },

  async deleteTeam(id) {
    const res = await apiClient.delete(`/teams/${id}`);
    return res.data.data;
  },

  async addMember(teamId, userId) {
    const res = await apiClient.post(`/teams/${teamId}/members`, { userId });
    return res.data.data;
  },

  async removeMember(teamId, userId) {
    const res = await apiClient.delete(`/teams/${teamId}/members/${userId}`);
    return res.data.data;
  }
};

import { apiClient } from './apiClient.js';

export const projectService = {
  async listProjects(params = {}) {
    const res = await apiClient.get('/projects', { params });
    return res.data;
  },

  async getProject(id) {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data.project;
  },

  async createProject(data) {
    const res = await apiClient.post('/projects', data);
    return res.data;
  },

  async updateProject(id, data) {
    const res = await apiClient.patch(`/projects/${id}`, data);
    return res.data;
  },

  async archiveProject(id) {
    const res = await apiClient.post(`/projects/${id}/archive`);
    return res.data;
  },

  async restoreProject(id) {
    const res = await apiClient.post(`/projects/${id}/restore`);
    return res.data;
  },

  async deleteProject(id) {
    const res = await apiClient.delete(`/projects/${id}`);
    return res.data;
  },

  async listMembers(projectId) {
    const res = await apiClient.get(`/projects/${projectId}/members`);
    return res.data.members;
  },

  async addMember(projectId, userId) {
    const res = await apiClient.post(`/projects/${projectId}/members`, { user_id: userId });
    return res.data.members;
  },

  async removeMember(projectId, userId) {
    const res = await apiClient.delete(`/projects/${projectId}/members/${userId}`);
    return res.data.members;
  },

  async addTeamMembers(projectId, teamId) {
    const res = await apiClient.post(`/projects/${projectId}/members/team/${teamId}`);
    return res.data.members;
  },

  async saveAsTemplate(projectId, data) {
    const res = await apiClient.post(`/projects/${projectId}/save-as-template`, data);
    return res.data;
  }
};

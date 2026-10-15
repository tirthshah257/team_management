import { apiClient } from './apiClient.js';

export const templateService = {
  async listTemplates() {
    const res = await apiClient.get('/project-templates');
    return res.data.templates;
  },

  async getTemplate(id) {
    const res = await apiClient.get(`/project-templates/${id}`);
    return res.data.template;
  },

  async createProjectFromTemplate(templateId, data) {
    const res = await apiClient.post(`/project-templates/${templateId}/create-project`, data);
    return res.data;
  },

  async deleteTemplate(id) {
    const res = await apiClient.delete(`/project-templates/${id}`);
    return res.data;
  }
};

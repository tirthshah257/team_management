import { apiClient } from './apiClient.js';

export const taskService = {
  async listProjectTasks(projectId, params = {}) {
    const res = await apiClient.get(`/projects/${projectId}/tasks`, { params });
    return res.data.tasks;
  },

  async getMyTasks() {
    const res = await apiClient.get('/tasks/my');
    return res.data;
  },

  async getTasksForLogging(params = {}) {
    const res = await apiClient.get('/tasks/for-logging', { params });
    return res.data.tasks;
  },

  async getTask(id) {
    const res = await apiClient.get(`/tasks/${id}`);
    return res.data.task;
  },

  async createTask(projectId, data) {
    const res = await apiClient.post(`/projects/${projectId}/tasks`, data);
    return res.data.task;
  },

  async updateTask(id, data) {
    const res = await apiClient.patch(`/tasks/${id}`, data);
    return res.data.task;
  },

  async moveTask(id, data) {
    const res = await apiClient.patch(`/tasks/${id}/move`, data);
    return res.data.task;
  },

  async deleteTask(id) {
    const res = await apiClient.delete(`/tasks/${id}`);
    return res.data;
  },

  async restoreTask(id) {
    const res = await apiClient.post(`/tasks/${id}/restore`);
    return res.data.task;
  },

  async addAssignee(taskId, userId) {
    const res = await apiClient.post(`/tasks/${taskId}/assignees`, { user_id: userId });
    return res.data.task;
  },

  async removeAssignee(taskId, userId) {
    const res = await apiClient.delete(`/tasks/${taskId}/assignees/${userId}`);
    return res.data.task;
  },

  async setTaskLabels(taskId, labelIds) {
    const res = await apiClient.put(`/tasks/${taskId}/labels`, { label_ids: labelIds });
    return res.data.task;
  },

  async setRecurrence(taskId, data) {
    const res = await apiClient.post(`/tasks/${taskId}/recurrence`, data);
    return res.data.rule;
  },

  async deleteRecurrence(ruleId) {
    const res = await apiClient.delete(`/recurring-tasks/${ruleId}`);
    return res.data;
  },

  // Subtasks
  async listSubtasks(taskId) {
    const res = await apiClient.get(`/tasks/${taskId}/subtasks`);
    return res.data.subtasks;
  },

  async createSubtask(taskId, data) {
    const res = await apiClient.post(`/tasks/${taskId}/subtasks`, data);
    return res.data.subtask;
  },

  async updateSubtask(id, data) {
    const res = await apiClient.patch(`/subtasks/${id}`, data);
    return res.data.subtask;
  },

  async deleteSubtask(id) {
    const res = await apiClient.delete(`/subtasks/${id}`);
    return res.data;
  }
};

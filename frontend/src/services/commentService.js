import { apiClient } from './apiClient.js';

export const commentService = {
  async listComments(taskId) {
    const res = await apiClient.get(`/tasks/${taskId}/comments`);
    return res.data.comments;
  },

  async createComment(taskId, data) {
    const res = await apiClient.post(`/tasks/${taskId}/comments`, data);
    return res.data.comment;
  },

  async updateComment(id, data) {
    const res = await apiClient.patch(`/comments/${id}`, data);
    return res.data.comment;
  },

  async deleteComment(id) {
    const res = await apiClient.delete(`/comments/${id}`);
    return res.data;
  }
};

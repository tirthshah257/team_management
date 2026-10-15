import { apiClient } from './apiClient.js';

export const invitationService = {
  async listInvitations(status = 'all') {
    const res = await apiClient.get('/invitations', { params: { status } });
    return res.data.data;
  },

  async createInvitation({ email, role }) {
    const res = await apiClient.post('/invitations', { email, role });
    return res.data.data;
  },

  async revokeInvitation(id) {
    const res = await apiClient.post(`/invitations/${id}/revoke`);
    return res.data.data;
  },

  async regenerateInvitation(id) {
    const res = await apiClient.post(`/invitations/${id}/regenerate`);
    return res.data.data;
  },

  async validateToken(token) {
    const res = await apiClient.get('/invitations/validate', { params: { token } });
    return res.data.data;
  },

  async acceptInvitation(token, data) {
    const res = await apiClient.post('/invitations/accept', data, { params: { token } });
    return res.data.data;
  },

  async onboardInvitation(id, data = {}) {
    const res = await apiClient.post(`/invitations/${id}/onboard`, data);
    return res.data.data;
  },

  async directOnboard(data) {
    const res = await apiClient.post('/invitations/direct-onboard', data);
    return res.data.data;
  }
};

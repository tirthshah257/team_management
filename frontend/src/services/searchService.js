import { apiClient } from './apiClient.js';

export const searchService = {
  async search(query, limit = 10) {
    const res = await apiClient.get('/search', { params: { q: query, limit } });
    return res.data;
  }
};

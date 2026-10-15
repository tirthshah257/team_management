import { SearchService } from '../services/search.service.js';

const searchService = new SearchService();

export async function globalSearch(req, res, next) {
  try {
    const { q, limit } = req.query;
    const results = searchService.globalSearch({
      query: q || '',
      user: req.user,
      workspaceId: req.user.workspace_id,
      limit: limit ? Number(limit) : 10
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

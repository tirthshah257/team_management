import { CommentService } from '../services/comment.service.js';
import { createCommentSchema, updateCommentSchema } from '../validators/collaboration.validators.js';

const commentService = new CommentService();

export async function listComments(req, res, next) {
  try {
    const comments = commentService.listComments(Number(req.params.id), req.user);
    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

export async function createComment(req, res, next) {
  try {
    const validated = createCommentSchema.parse(req.body);
    const comment = commentService.createComment(Number(req.params.id), req.user, validated);
    res.status(201).json({ comment, message: 'Comment added successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateComment(req, res, next) {
  try {
    const validated = updateCommentSchema.parse(req.body);
    const comment = commentService.updateComment(Number(req.params.id), req.user, validated);
    res.json({ comment, message: 'Comment updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteComment(req, res, next) {
  try {
    const result = commentService.deleteComment(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

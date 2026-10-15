import { getDatabase } from '../db/connection.js';
import { TaskService } from './task.service.js';
import { NotificationService } from './notification.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

export class CommentService {
  constructor(db) {
    this.db = db || getDatabase();
    this.taskService = new TaskService(this.db);
    this.notificationService = new NotificationService(this.db);
  }

  listComments(taskId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    // Verify task is accessible
    this.taskService.getAccessibleTask(taskId, user, wsId);

    const comments = this.db.prepare(`
      SELECT c.*,
        u.name as author_name,
        u.email as author_email,
        u.avatar_color as author_avatar_color,
        u.role as author_role
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.task_id = ? AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `).all(taskId);

    if (comments.length === 0) return [];

    const commentIds = comments.map(c => c.id);
    const placeholders = commentIds.map(() => '?').join(',');

    const mentions = this.db.prepare(`
      SELECT cm.comment_id, u.id, u.name, u.email
      FROM comment_mentions cm
      JOIN users u ON cm.mentioned_user_id = u.id
      WHERE cm.comment_id IN (${placeholders})
    `).all(...commentIds);

    const mentionsByComment = new Map();
    for (const m of mentions) {
      if (!mentionsByComment.has(m.comment_id)) mentionsByComment.set(m.comment_id, []);
      mentionsByComment.get(m.comment_id).push(m);
    }

    return comments.map(c => ({
      ...c,
      mentions: mentionsByComment.get(c.id) || []
    }));
  }

  createComment(taskId, user, { body }, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.taskService.getAccessibleTask(taskId, user, wsId);

    if (task.project_status === 'archived') {
      throw new ValidationError('Cannot comment on tasks in an archived project');
    }

    // Parse @mentions from body
    // Supports @[Name](userId) or @email or @name
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    const matches = [...body.matchAll(mentionRegex)].map(m => m[1]);

    const mentionedUserIds = new Set();
    if (matches.length > 0) {
      const users = this.db.prepare(`
        SELECT id, name, email FROM users
        WHERE workspace_id = ? AND is_active = 1
      `).all(wsId);

      for (const token of matches) {
        const found = users.find(u =>
          u.email.toLowerCase().includes(token.toLowerCase()) ||
          u.name.toLowerCase().replace(/\s+/g, '').includes(token.toLowerCase())
        );
        if (found && found.id !== user.id) {
          mentionedUserIds.add(found.id);
        }
      }
    }

    const tx = this.db.transaction(() => {
      const result = this.db.prepare(`
        INSERT INTO comments (task_id, author_id, body)
        VALUES (?, ?, ?)
      `).run(taskId, user.id, body);

      const commentId = result.lastInsertRowid;

      // Mentions
      const insertMention = this.db.prepare(`
        INSERT INTO comment_mentions (comment_id, mentioned_user_id)
        VALUES (?, ?)
      `);

      for (const mId of mentionedUserIds) {
        insertMention.run(commentId, mId);

        // Notify mentioned user
        this.notificationService.notify({
          workspaceId: wsId,
          recipientId: mId,
          actorId: user.id,
          type: 'mentioned',
          title: `${user.name} mentioned you`,
          message: body.slice(0, 100),
          entityType: 'task',
          entityId: taskId
        });
      }

      // Notify task assignees
      const assignees = this.db.prepare(`
        SELECT user_id FROM task_assignees WHERE task_id = ?
      `).all(taskId);

      for (const a of assignees) {
        if (a.user_id !== user.id && !mentionedUserIds.has(a.user_id)) {
          this.notificationService.notify({
            workspaceId: wsId,
            recipientId: a.user_id,
            actorId: user.id,
            type: 'comment_added',
            title: `New comment on: ${task.title}`,
            message: `${user.name}: "${body.slice(0, 80)}"`,
            entityType: 'task',
            entityId: taskId
          });
        }
      }

      return commentId;
    });

    const commentId = tx();
    const comment = this.db.prepare(`
      SELECT c.*,
        u.name as author_name,
        u.email as author_email,
        u.avatar_color as author_avatar_color,
        u.role as author_role
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    return {
      ...comment,
      mentions: Array.from(mentionedUserIds)
    };
  }

  updateComment(commentId, user, { body }, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const comment = this.db.prepare(`
      SELECT c.*, t.project_id
      FROM comments c
      JOIN tasks t ON c.task_id = t.id
      WHERE c.id = ? AND t.workspace_id = ? AND c.deleted_at IS NULL
    `).get(commentId, wsId);

    if (!comment) throw new NotFoundError('Comment not found');

    if (comment.author_id !== user.id) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    this.db.prepare(`
      UPDATE comments
      SET body = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(body, commentId);

    return this.db.prepare(`
      SELECT c.*,
        u.name as author_name,
        u.email as author_email,
        u.avatar_color as author_avatar_color,
        u.role as author_role
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `).get(commentId);
  }

  deleteComment(commentId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const comment = this.db.prepare(`
      SELECT c.*, t.project_id
      FROM comments c
      JOIN tasks t ON c.task_id = t.id
      WHERE c.id = ? AND t.workspace_id = ? AND c.deleted_at IS NULL
    `).get(commentId, wsId);

    if (!comment) throw new NotFoundError('Comment not found');

    // Only owner or Admin can delete
    if (comment.author_id !== user.id && user.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to delete this comment');
    }

    this.db.prepare(`
      UPDATE comments
      SET deleted_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(commentId);

    return { message: 'Comment deleted successfully' };
  }
}

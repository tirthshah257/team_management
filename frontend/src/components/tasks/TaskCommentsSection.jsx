import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2, Edit2, AtSign, MessageSquare } from 'lucide-react';
import { commentService } from '../../services/commentService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { formatDistanceToNow, parseISO } from 'date-fns';

export function TaskCommentsSection({ taskId, members = [] }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [body, setBody] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const textareaRef = useRef(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => commentService.listComments(taskId),
    enabled: !!taskId
  });

  const createCommentMutation = useMutation({
    mutationFn: (text) => commentService.createComment(taskId, { body: text }),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      showToast('Comment posted', 'success');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to post comment', 'error');
    }
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ id, text }) => commentService.updateComment(id, { body: text }),
    onSuccess: () => {
      setEditingCommentId(null);
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      showToast('Comment updated', 'success');
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id) => commentService.deleteComment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      showToast('Comment deleted', 'info');
    }
  });

  const handleTextChange = (e) => {
    const val = e.target.value;
    setBody(val);
    const lastWord = val.split(/\s+/).pop();
    if (lastWord && lastWord.startsWith('@')) {
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const insertMention = (memberName) => {
    const words = body.split(/\s+/);
    words.pop(); // remove the partial '@...'
    const cleanName = memberName.replace(/\s+/g, '');
    const newText = [...words, `@${cleanName} `].join(' ');
    setBody(newText);
    setShowMentionSuggestions(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (body.trim()) {
      createCommentMutation.mutate(body.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="p-6 text-center text-slate-400 text-xs">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
            <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700" />
            <span>No comments yet. Start the conversation with your team!</span>
          </div>
        ) : (
          comments.map(c => {
            const isOwner = c.author_id === user?.id;
            const canDelete = isOwner || user?.role === 'admin';
            const isEditing = editingCommentId === c.id;

            return (
              <div
                key={c.id}
                className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={c.author_name} color={c.author_avatar_color} size="xs" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {c.author_name}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-2">
                        {c.created_at ? formatDistanceToNow(parseISO(c.created_at), { addSuffix: true }) : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isOwner && !isEditing && (
                      <button
                        onClick={() => {
                          setEditingCommentId(c.id);
                          setEditBody(c.body);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => deleteCommentMutation.mutate(c.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-800 dark:text-slate-200"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button size="xs" variant="secondary" onClick={() => setEditingCommentId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => updateCommentMutation.mutate({ id: c.id, text: editBody })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {c.body}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mention suggestions popup */}
      {showMentionSuggestions && members.length > 0 && (
        <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
            Mention Teammate
          </div>
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => insertMention(m.name)}
              className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-left text-xs text-slate-800 dark:text-slate-200"
            >
              <Avatar name={m.name} color={m.avatar_color} size="xs" />
              <span>{m.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* New Comment Input */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={3}
            value={body}
            onChange={handleTextChange}
            placeholder="Write a comment... (Type @ to mention teammates)"
            className="w-full text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 focus:ring-primary-500 shadow-sm"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-slate-400">
            Tip: Type <code className="text-primary-500 font-mono">@name</code> to notify team members
          </span>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            disabled={!body.trim() || createCommentMutation.isPending}
            loading={createCommentMutation.isPending}
            className="gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Post Comment
          </Button>
        </div>
      </form>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Check, CheckCheck, Clock, MessageSquare, AlertCircle,
  Calendar, CheckSquare, Users, UserCheck
} from 'lucide-react';
import { notificationService } from '../../services/notificationService.js';
import { formatDistanceToNow, parseISO } from 'date-fns';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 15000
  });

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: () => notificationService.listNotifications({ limit: 8 }),
    enabled: isOpen
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    }
  });

  const notifications = data?.notifications || [];

  const handleNotificationClick = (n) => {
    if (!n.read_at) {
      markAsReadMutation.mutate(n.id);
    }
    setIsOpen(false);

    if (n.entity_type === 'task' && n.entity_id) {
      navigate(`/my-tasks?taskId=${n.entity_id}`);
    } else if (n.entity_type === 'project' && n.entity_id) {
      navigate(`/projects/${n.entity_id}`);
    } else if (n.entity_type === 'leave_request') {
      navigate('/leave');
    } else if (n.entity_type === 'invitation' || n.type === 'invitation_accepted' || n.entity_type === 'user') {
      navigate('/members');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden z-50 animate-fade-in">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <div className="p-6 text-center text-slate-400 text-xs">Loading updates...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No notifications right now. You're all caught up!
              </div>
            ) : (
              notifications.map(n => {
                const isUnread = !n.read_at;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                      isUnread ? 'bg-primary-50/30 dark:bg-primary-950/20' : ''
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {n.type === 'comment_added' || n.type === 'mentioned' ? (
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                      ) : n.type === 'leave_requested' || n.type === 'leave_decided' ? (
                        <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                      ) : n.type === 'invitation_accepted' || n.entity_type === 'invitation' ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                          <UserCheck className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
                          <CheckSquare className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs truncate ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                          {n.title}
                        </span>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />
                        )}
                      </div>

                      {n.message && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                          {n.message}
                        </p>
                      )}

                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {n.created_at ? formatDistanceToNow(parseISO(n.created_at), { addSuffix: true }) : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

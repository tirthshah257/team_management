import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, Clock } from 'lucide-react';
import { timeService } from '../../services/timeService.js';
import { useToast } from '../../context/ToastContext.jsx';

export function GlobalTimerWidget() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { data: activeTimer } = useQuery({
    queryKey: ['active-timer'],
    queryFn: () => timeService.getActiveTimer(),
    refetchInterval: 30000
  });

  // Timer tick
  useEffect(() => {
    if (!activeTimer || !activeTimer.started_at) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(activeTimer.started_at).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - startMs) / 1000)));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  const stopTimerMutation = useMutation({
    mutationFn: () => timeService.stopTimer(activeTimer.task_id),
    onSuccess: (entry) => {
      queryClient.setQueryData(['active-timer'], null);
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });

      const mins = Math.round((entry?.duration_seconds || 0) / 60);
      showToast(`Logged ${mins} minute(s) on ${entry?.task_title || 'task'}`, 'success');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to stop timer', 'error');
    }
  });

  if (!activeTimer) return null;

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${hours > 0 ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-950/60 border border-primary-200 dark:border-primary-800/80 rounded-full px-3 py-1 shadow-xs animate-pulse-subtle">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
      <span className="text-xs font-mono font-bold text-primary-700 dark:text-primary-300">
        {timeFormatted}
      </span>
      <span className="hidden md:inline-block text-[11px] text-slate-500 max-w-[120px] truncate font-medium">
        {activeTimer.task_title}
      </span>
      <button
        onClick={() => stopTimerMutation.mutate()}
        disabled={stopTimerMutation.isPending}
        className="p-1 rounded-full bg-rose-500 hover:bg-rose-600 text-white transition-colors"
        title="Stop Timer"
      >
        <Square className="w-3 h-3 fill-current" />
      </button>
    </div>
  );
}

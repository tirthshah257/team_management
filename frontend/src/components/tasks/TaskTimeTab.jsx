import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, Clock, Plus, Trash2 } from 'lucide-react';
import { timeService } from '../../services/timeService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';

export function TaskTimeTab({ taskId }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [elapsed, setElapsed] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(30);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualNote, setManualNote] = useState('');

  const { data: activeTimer } = useQuery({
    queryKey: ['active-timer'],
    queryFn: () => timeService.getActiveTimer()
  });

  const isRunningOnThisTask = activeTimer && activeTimer.task_id === Number(taskId);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['task-time-entries', taskId],
    queryFn: () => timeService.listEntries({ taskId })
  });

  // Ticking effect when running
  useEffect(() => {
    if (!isRunningOnThisTask || !activeTimer?.started_at) {
      setElapsed(0);
      return;
    }

    const startMs = new Date(activeTimer.started_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRunningOnThisTask, activeTimer]);

  const startTimerMutation = useMutation({
    mutationFn: () => timeService.startTimer(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
      showToast('Stopwatch started', 'success');
    }
  });

  const stopTimerMutation = useMutation({
    mutationFn: () => timeService.stopTimer(taskId),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      showToast('Timer stopped and time recorded', 'success');
    }
  });

  const manualLogMutation = useMutation({
    mutationFn: () => timeService.createManualEntry({
      task_id: taskId,
      entry_date: manualDate,
      duration_seconds: manualMinutes * 60,
      note: manualNote || null
    }),
    onSuccess: () => {
      setManualNote('');
      queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      showToast('Logged time entry successfully', 'success');
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id) => timeService.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      showToast('Time entry removed', 'info');
    }
  });

  const formatSec = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`;
  };

  const totalLoggedSec = entries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stopwatch Section */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-full ${isRunningOnThisTask ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-primary-100 text-primary-600'}`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isRunningOnThisTask ? 'Stopwatch Active' : 'Live Timer'}
            </div>
            <div className="text-xl font-mono font-extrabold text-slate-900 dark:text-white">
              {isRunningOnThisTask ? formatSec(elapsed) : '00m 00s'}
            </div>
          </div>
        </div>

        <div>
          {isRunningOnThisTask ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => stopTimerMutation.mutate()}
              className="gap-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Stop
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => startTimerMutation.mutate()}
              className="gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Start Timer
            </Button>
          )}
        </div>
      </div>

      {/* Manual Entry Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          manualLogMutation.mutate();
        }}
        className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3"
      >
        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Manual Time Log
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Date</label>
            <Input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Minutes</label>
            <Input
              type="number"
              min="5"
              step="5"
              value={manualMinutes}
              onChange={(e) => setManualMinutes(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Note (Optional)</label>
          <Input
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="e.g. Code review and QA verification"
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" variant="secondary" type="submit" loading={manualLogMutation.isPending}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Log Time
          </Button>
        </div>
      </form>

      {/* History Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <span>Logged Entries</span>
          <span className="text-primary-600 font-mono">Total: {Math.round((totalLoggedSec / 3600) * 10) / 10}h</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/70 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
          {entries.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              No time entries logged on this task yet.
            </div>
          ) : (
            entries.map(e => (
              <div key={e.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {e.user_name} • {Math.round((e.duration_seconds / 60))} mins
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {e.entry_date} {e.note ? `— "${e.note}"` : ''} ({e.entry_type})
                  </div>
                </div>

                <button
                  onClick={() => deleteEntryMutation.mutate(e.id)}
                  className="text-slate-400 hover:text-rose-500 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

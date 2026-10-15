import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, isSameDay
} from 'date-fns';
import {
  Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus,
  Trash2, User, Filter, FileText, CheckCircle2, Play, Search, AlertCircle
} from 'lucide-react';
import { timeService } from '../../services/timeService.js';
import { taskService } from '../../services/taskService.js';
import { userService } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { TaskDrawer } from '../../components/tasks/TaskDrawer.jsx';

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '-';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

export function TimesheetsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [targetUserId, setTargetUserId] = useState('');
  const [viewMode, setViewMode] = useState('matrix'); // 'matrix' | 'list'
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Manual Log Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    taskId: '',
    entryDate: new Date().toISOString().split('T')[0],
    hours: '1',
    minutes: '0',
    note: ''
  });

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  // Compute 7 days of the current week (starting Monday)
  const weekStart = useMemo(() => startOfWeek(currentWeekDate, { weekStartsOn: 1 }), [currentWeekDate]);
  const weekEnd = useMemo(() => endOfWeek(currentWeekDate, { weekStartsOn: 1 }), [currentWeekDate]);
  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => addDays(weekStart, idx));
  }, [weekStart]);

  const fromStr = format(weekStart, 'yyyy-MM-dd');
  const toStr = format(weekEnd, 'yyyy-MM-dd');

  // Fetch timesheets matrix
  const { data: timesheetData, isLoading: isTimesheetLoading } = useQuery({
    queryKey: ['timesheets', fromStr, toStr, targetUserId],
    queryFn: () => timeService.getTimesheets({
      from: fromStr,
      to: toStr,
      targetUserId: targetUserId || undefined
    })
  });

  // Fetch detailed list of entries
  const { data: listEntries = [], isLoading: isListLoading } = useQuery({
    queryKey: ['time-entries', fromStr, toStr, targetUserId],
    queryFn: () => timeService.listEntries({
      from: fromStr,
      to: toStr,
      targetUserId: targetUserId || undefined
    }),
    enabled: viewMode === 'list'
  });

  const [taskSearch, setTaskSearch] = useState('');

  // Fetch tasks for manual log modal (only tasks assigned to the user performing work)
  const { data: tasksForLoggingData, isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks-for-logging', targetUserId],
    queryFn: () => taskService.getTasksForLogging(targetUserId ? { userId: targetUserId } : {}),
    enabled: isLogModalOpen
  });

  // Fetch users for target user picker (Admins / Managers)
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => userService.listUsers({ limit: 100 }),
    enabled: canManage
  });

  const allUsers = usersData?.users || [];

  const targetUserObj = useMemo(() => {
    if (!targetUserId) return null;
    return allUsers.find(u => String(u.id) === String(targetUserId)) || null;
  }, [allUsers, targetUserId]);

  const availableTasks = useMemo(() => {
    if (Array.isArray(tasksForLoggingData)) return tasksForLoggingData;
    if (tasksForLoggingData?.tasks) return tasksForLoggingData.tasks;
    return [];
  }, [tasksForLoggingData]);

  const filteredTasks = useMemo(() => {
    if (!taskSearch.trim()) return availableTasks;
    const term = taskSearch.toLowerCase();
    return availableTasks.filter(t =>
      (t.title && t.title.toLowerCase().includes(term)) ||
      (t.project_name && t.project_name.toLowerCase().includes(term))
    );
  }, [availableTasks, taskSearch]);

  const selectedTaskObj = useMemo(() => {
    if (!logForm.taskId) return null;
    return availableTasks.find(t => String(t.id) === String(logForm.taskId)) || null;
  }, [availableTasks, logForm.taskId]);

  // Manual Log Mutation
  const createEntryMutation = useMutation({
    mutationFn: (data) => timeService.createManualEntry(data),
    onSuccess: () => {
      success('Time Logged', 'Time entry logged successfully.');
      setIsLogModalOpen(false);
      setTaskSearch('');
      setLogForm({
        taskId: '',
        entryDate: new Date().toISOString().split('T')[0],
        hours: '1',
        minutes: '0',
        note: ''
      });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err) => {
      toastError('Log Failed', err.response?.data?.message || err.message);
    }
  });

  // Delete Entry Mutation
  const deleteEntryMutation = useMutation({
    mutationFn: (id) => timeService.deleteEntry(id),
    onSuccess: () => {
      success('Entry Deleted', 'Time entry has been removed.');
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    },
    onError: (err) => {
      toastError('Delete Failed', err.response?.data?.message || err.message);
    }
  });

  const handlePrevWeek = () => setCurrentWeekDate(subWeeks(currentWeekDate, 1));
  const handleNextWeek = () => setCurrentWeekDate(addWeeks(currentWeekDate, 1));
  const handleToday = () => setCurrentWeekDate(new Date());

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!logForm.taskId) {
      toastError('Task Required', 'Please select a task to log time for.');
      return;
    }
    const h = parseInt(logForm.hours || '0', 10);
    const m = parseInt(logForm.minutes || '0', 10);
    const totalSec = h * 3600 + m * 60;

    if (totalSec <= 0) {
      toastError('Invalid Duration', 'Total logged duration must be greater than 0 minutes.');
      return;
    }

    createEntryMutation.mutate({
      task_id: Number(logForm.taskId),
      user_id: targetUserId ? Number(targetUserId) : undefined,
      entry_date: logForm.entryDate,
      duration_seconds: totalSec,
      note: logForm.note.trim() || undefined
    });
  };

  const rows = timesheetData?.rows || [];
  const totalWeeklySeconds = timesheetData?.total_logged_seconds || 0;

  // Calculate daily totals for column footer
  const dailyTotals = useMemo(() => {
    const totals = {};
    for (const d of daysOfWeek) {
      const dateKey = format(d, 'yyyy-MM-dd');
      totals[dateKey] = 0;
    }
    for (const r of rows) {
      for (const [dateKey, sec] of Object.entries(r.days || {})) {
        if (totals[dateKey] !== undefined) {
          totals[dateKey] += sec;
        }
      }
    }
    return totals;
  }, [rows, daysOfWeek]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Timesheets & Time Tracking
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track work hours, review weekly submissions, and inspect project time allocation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <div className="w-48">
              <Select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="text-xs"
              >
                <option value="">My Timesheet</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </Select>
            </div>
          )}

          <Button
            size="sm"
            onClick={() => setIsLogModalOpen(true)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Time
          </Button>
        </div>
      </div>

      {/* Week Navigator & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-card border border-slate-200/80 dark:border-slate-800 shadow-card">
        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800/50">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Current Week
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-2">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </div>
        </div>

        {/* View Switcher & Total hours badge */}
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Weekly Total: <strong className="text-brand-600 dark:text-brand-400 font-bold">{formatDuration(totalWeeklySeconds)}</strong>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Weekly Matrix
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Log Details
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'matrix' ? (
        <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-4 min-w-[220px]">Task & Project</th>
                  {daysOfWeek.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <th
                        key={day.toISOString()}
                        className={`py-3 px-3 text-center min-w-[80px] ${
                          isToday ? 'bg-brand-50/60 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 font-bold' : ''
                        }`}
                      >
                        <div>{format(day, 'EEE')}</div>
                        <div className="text-[10px] font-normal">{format(day, 'MMM d')}</div>
                      </th>
                    );
                  })}
                  <th className="py-3 px-4 text-right min-w-[90px] font-bold text-slate-800 dark:text-slate-200">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      No time logged for this week. Use the &quot;Log Time&quot; button to track task hours.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.task_id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(row.task_id)}
                          className="text-left group font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: row.project_color || '#4F46E5' }}
                            />
                            <span className="truncate max-w-[200px]">{row.task_title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 pl-4 block">
                            {row.project_name}
                          </span>
                        </button>
                      </td>

                      {daysOfWeek.map((day) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const sec = row.days[dateKey] || 0;
                        const isToday = isSameDay(day, new Date());

                        return (
                          <td
                            key={dateKey}
                            className={`py-3 px-3 text-center ${
                              isToday ? 'bg-brand-50/20 dark:bg-brand-950/10' : ''
                            }`}
                          >
                            <span className={sec > 0 ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}>
                              {formatDuration(sec)}
                            </span>
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatDuration(row.total_seconds)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Table Footer with Daily & Weekly Totals */}
              <tfoot>
                <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
                  <td className="py-3 px-4">Daily Total</td>
                  {daysOfWeek.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const sec = dailyTotals[dateKey] || 0;
                    return (
                      <td key={dateKey} className="py-3 px-3 text-center">
                        <span className={sec > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}>
                          {formatDuration(sec)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right text-brand-600 dark:text-brand-400 font-bold">
                    {formatDuration(totalWeeklySeconds)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        /* Detailed Log Entries View */
        <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Task & Project</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Note</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {listEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No detailed entries recorded for this time frame.
                    </td>
                  </tr>
                ) : (
                  listEntries.map((entry) => {
                    const isOwn = entry.user_id === user?.id;
                    const canDelete = isOwn || user?.role === 'admin';

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {entry.entry_date}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Avatar name={entry.user_name} color={entry.user_avatar_color} size="xs" />
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {entry.user_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setSelectedTaskId(entry.task_id)}
                            className="text-left hover:text-brand-600 dark:hover:text-brand-400"
                          >
                            <span className="font-medium text-slate-900 dark:text-slate-100 block">
                              {entry.task_title}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {entry.project_name}
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {formatDuration(entry.duration_seconds)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {entry.note || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canDelete && (
                            <button
                              onClick={() => deleteEntryMutation.mutate(entry.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Task Drawer */}
      {selectedTaskId && (
        <TaskDrawer
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onTaskDeleted={() => {
            setSelectedTaskId(null);
            queryClient.invalidateQueries({ queryKey: ['timesheets'] });
          }}
        />
      )}

      {/* Manual Log Time Modal */}
      {isLogModalOpen && (
        <Modal
          isOpen={isLogModalOpen}
          onClose={() => {
            setIsLogModalOpen(false);
            setTaskSearch('');
          }}
          title={targetUserObj ? `Log Time for ${targetUserObj.name}` : "Log Time on Task"}
          size="md"
        >
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>Assigned Task *</span>
                  {targetUserObj && (
                    <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                      Performer: {targetUserObj.name}
                    </span>
                  )}
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {availableTasks.length} assigned {availableTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              {availableTasks.length > 4 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search assigned tasks by title or project..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="pl-8 text-xs py-1.5"
                  />
                </div>
              )}

              {isTasksLoading ? (
                <div className="py-3 text-center text-xs text-slate-500">
                  Loading tasks...
                </div>
              ) : availableTasks.length === 0 ? (
                <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <p className="font-semibold">No tasks assigned to {targetUserObj ? targetUserObj.name : 'you'}</p>
                    <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                      Only tasks assigned to the particular user who performs them can be logged. Please assign a task in a project first.
                    </p>
                  </div>
                </div>
              ) : (
                <Select
                  value={logForm.taskId}
                  onChange={(e) => setLogForm(prev => ({ ...prev, taskId: e.target.value }))}
                  required
                  className="text-xs"
                >
                  <option value="">-- Choose an assigned task to log time --</option>
                  {filteredTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.project_name ? `[${t.project_name}] ` : ''}{t.title} ({t.status || 'open'}{t.priority ? ` • ${t.priority}` : ''})
                    </option>
                  ))}
                </Select>
              )}

              {/* Selected Task Details Preview Card */}
              {selectedTaskObj && (
                <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {selectedTaskObj.project_color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: selectedTaskObj.project_color }}
                        />
                      )}
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate text-[11px]">
                        {selectedTaskObj.project_name || 'Project'}
                      </span>
                    </div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {selectedTaskObj.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedTaskObj.priority && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {selectedTaskObj.priority}
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded capitalize bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      {selectedTaskObj.status || 'open'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Date *
              </label>
              <Input
                type="date"
                value={logForm.entryDate}
                onChange={(e) => setLogForm(prev => ({ ...prev, entryDate: e.target.value }))}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Hours
                </label>
                <Input
                  type="number"
                  min="0"
                  max="24"
                  value={logForm.hours}
                  onChange={(e) => setLogForm(prev => ({ ...prev, hours: e.target.value }))}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Minutes
                </label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  step="5"
                  value={logForm.minutes}
                  onChange={(e) => setLogForm(prev => ({ ...prev, minutes: e.target.value }))}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Work Note (Optional)
              </label>
              <Input
                placeholder="What did you accomplish?"
                value={logForm.note}
                onChange={(e) => setLogForm(prev => ({ ...prev, note: e.target.value }))}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsLogModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createEntryMutation.isPending || !logForm.taskId}
              >
                {createEntryMutation.isPending ? 'Logging...' : 'Save Time'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export default TimesheetsPage;

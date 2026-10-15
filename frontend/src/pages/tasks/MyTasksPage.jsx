import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Clock, AlertCircle, Calendar, ArrowRight,
  ListTodo, ChevronDown, ChevronRight, CheckSquare
} from 'lucide-react';
import { taskService } from '../../services/taskService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TaskDrawer } from '../../components/tasks/TaskDrawer.jsx';
import { PriorityBadge } from '../../components/ui/PriorityBadge.jsx';

function TaskSection({ title, count, colorClass, tasks, isOpen, onToggle, onSelectTask, onToggleStatus }) {
  if (tasks.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between bg-slate-50/75 dark:bg-slate-800/40 hover:bg-slate-100/75 dark:hover:bg-slate-800/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className={`w-2 h-2 rounded-full ${colorClass}`} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {title}
          </h3>
          <span className="text-[11px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
      </button>

      {/* Task List */}
      {isOpen && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {tasks.map(task => {
            const isDone = task.status === 'done';

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
              >
                {/* Left: Checkbox + Project tag + Title */}
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => onToggleStatus(task.id, isDone ? 'todo' : 'done')}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                  </div>

                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: task.project_color || '#4F46E5' }}
                    title={task.project_name}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold truncate ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                        {task.title}
                      </span>
                      {task.subtask_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 font-mono">
                          <CheckSquare className="w-2.5 h-2.5" />
                          {task.subtask_completed_count || 0}/{task.subtask_count}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {task.project_name}
                    </div>
                  </div>
                </div>

                {/* Right: Priority + Due Date */}
                <div className="flex items-center gap-3 shrink-0">
                  <PriorityBadge priority={task.priority} />

                  {task.due_date && (
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {task.due_date}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MyTasksPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const [openSections, setOpenSections] = useState({
    overdue: true,
    today: true,
    this_week: true,
    later: true,
    no_date: false,
    completed: false
  });

  const toggleSection = (sec) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => taskService.getMyTasks()
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ taskId, status }) => taskService.updateTask(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const groups = data?.groups || {};
  const counts = data?.counts || {};

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <ListTodo className="w-7 h-7 text-primary-500" />
          My Tasks
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Everything assigned to you across all projects, prioritized by deadline.
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Active Tasks
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {counts.total_active || 0}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Overdue
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {counts.overdue || 0}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Due Today
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {counts.today || 0}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> This Week
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {counts.this_week || 0}
          </div>
        </div>
      </div>

      {/* Task Sections */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-slate-100 dark:bg-slate-800/40 rounded-2xl" />
          <div className="h-32 bg-slate-100 dark:bg-slate-800/40 rounded-2xl" />
        </div>
      ) : counts.total_active === 0 && (counts.completed || 0) === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">All Caught Up!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You don't have any tasks assigned to you right now. Great job or head over to Projects to collaborate!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <TaskSection
            title="Overdue"
            count={counts.overdue || 0}
            colorClass="bg-rose-500"
            tasks={groups.overdue || []}
            isOpen={openSections.overdue}
            onToggle={() => toggleSection('overdue')}
            onSelectTask={setSelectedTaskId}
            onToggleStatus={(id, st) => toggleStatusMutation.mutate({ taskId: id, status: st })}
          />

          <TaskSection
            title="Due Today"
            count={counts.today || 0}
            colorClass="bg-amber-500"
            tasks={groups.today || []}
            isOpen={openSections.today}
            onToggle={() => toggleSection('today')}
            onSelectTask={setSelectedTaskId}
            onToggleStatus={(id, st) => toggleStatusMutation.mutate({ taskId: id, status: st })}
          />

          <TaskSection
            title="Due This Week"
            count={counts.this_week || 0}
            colorClass="bg-blue-500"
            tasks={groups.this_week || []}
            isOpen={openSections.this_week}
            onToggle={() => toggleSection('this_week')}
            onSelectTask={setSelectedTaskId}
            onToggleStatus={(id, st) => toggleStatusMutation.mutate({ taskId: id, status: st })}
          />

          <TaskSection
            title="Later"
            count={counts.later || 0}
            colorClass="bg-slate-400"
            tasks={groups.later || []}
            isOpen={openSections.later}
            onToggle={() => toggleSection('later')}
            onSelectTask={setSelectedTaskId}
            onToggleStatus={(id, st) => toggleStatusMutation.mutate({ taskId: id, status: st })}
          />

          <TaskSection
            title="No Due Date"
            count={counts.no_date || 0}
            colorClass="bg-slate-300 dark:bg-slate-600"
            tasks={groups.no_date || []}
            isOpen={openSections.no_date}
            onToggle={() => toggleSection('no_date')}
            onSelectTask={setSelectedTaskId}
            onToggleStatus={(id, st) => toggleStatusMutation.mutate({ taskId: id, status: st })}
          />

          <TaskSection
            title="Completed"
            count={counts.completed || 0}
            colorClass="bg-emerald-500"
            tasks={groups.completed || []}
            isOpen={openSections.completed}
            onToggle={() => toggleSection('completed')}
            onSelectTask={setSelectedTaskId}
            onToggleStatus={(id, st) => toggleStatusMutation.mutate({ taskId: id, status: st })}
          />
        </div>
      )}

      {/* Task Drawer */}
      <TaskDrawer
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskDeleted={() => setSelectedTaskId(null)}
      />
    </div>
  );
}

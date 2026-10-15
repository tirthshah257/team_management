import React, { useState } from 'react';
import {
  Calendar, CheckSquare, Plus, ArrowUpDown, Clock, Filter, Search
} from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import { PriorityBadge } from '../ui/PriorityBadge.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';

export function TaskListView({
  tasks,
  onSelectTask,
  onToggleStatus,
  onQuickAddTask
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [quickTitle, setQuickTitle] = useState('');

  const filteredTasks = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleQuickAdd = (e) => {
    e.preventDefault();
    if (quickTitle.trim()) {
      onQuickAddTask('todo', quickTitle.trim());
      setQuickTitle('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Control / Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border-0 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-200"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border-0 rounded-xl py-1.5 px-3 text-slate-700 dark:text-slate-300 focus:ring-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border-0 rounded-xl py-1.5 px-3 text-slate-700 dark:text-slate-300 focus:ring-primary-500"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Quick Add Form */}
      <form onSubmit={handleQuickAdd} className="flex gap-2">
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="+ Quick add a new task... (Press Enter to save)"
          className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white shadow-sm"
        />
        <Button size="sm" variant="primary" type="submit" disabled={!quickTitle.trim()}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </form>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Task</th>
                <th className="py-3 px-4 w-28">Status</th>
                <th className="py-3 px-4 w-28">Priority</th>
                <th className="py-3 px-4 w-32">Due Date</th>
                <th className="py-3 px-4 w-32">Assignees</th>
                <th className="py-3 px-4 w-36">Labels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No tasks found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredTasks.map(task => {
                  const isDone = task.status === 'done';
                  const isOverdue = task.due_date && !isDone && task.due_date < new Date().toISOString().split('T')[0];

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onSelectTask(task.id)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => onToggleStatus(task.id, isDone ? 'todo' : 'done')}
                          className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                        />
                      </td>

                      {/* Title & Subtasks */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                            {task.title}
                          </span>
                          {task.subtask_count > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full font-mono">
                              <CheckSquare className="w-2.5 h-2.5" />
                              {task.subtask_completed_count || 0}/{task.subtask_count}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={task.status} />
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <PriorityBadge priority={task.priority} />
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4">
                        {task.due_date ? (
                          <span className={`inline-flex items-center gap-1 font-medium ${isOverdue ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}`}>
                            <Calendar className="w-3 h-3" />
                            {task.due_date}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Assignees */}
                      <td className="py-3 px-4">
                        <div className="flex items-center -space-x-1.5 overflow-hidden">
                          {task.assignees?.map(a => (
                            <Avatar key={a.id} name={a.name} color={a.avatar_color} size="xs" />
                          ))}
                        </div>
                      </td>

                      {/* Labels */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {task.labels?.map(l => (
                            <span
                              key={l.id}
                              className="text-[9px] px-1.5 py-0.5 rounded font-medium text-white truncate"
                              style={{ backgroundColor: l.color }}
                            >
                              {l.name}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

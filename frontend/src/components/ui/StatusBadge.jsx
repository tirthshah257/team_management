import React from 'react';

const STATUS_CONFIGS = {
  // Tasks
  todo: { label: 'To Do', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  done: { label: 'Done', bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },

  // Projects
  active: { label: 'Active', bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  on_hold: { label: 'On Hold', bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  completed: { label: 'Completed', bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  archived: { label: 'Archived', bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' },

  // Leave & general
  pending: { label: 'Pending', bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  approved: { label: 'Approved', bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  rejected: { label: 'Rejected', bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
};

export function StatusBadge({ status, size = 'sm', className = '' }) {
  const normalized = String(status || '').toLowerCase();
  const config = STATUS_CONFIGS[normalized] || {
    label: status || 'Unknown',
    bg: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold'
  }[size] || 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClasses} ${config.bg} ${className}`}>
      {config.label}
    </span>
  );
}

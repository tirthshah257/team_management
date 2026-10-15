import React from 'react';
import { AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';

const PRIORITY_CONFIGS = {
  low: { label: 'Low', icon: ArrowDown, color: 'text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  medium: { label: 'Medium', icon: Minus, color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800' },
  high: { label: 'High', icon: ArrowUp, color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800' },
  urgent: { label: 'Urgent', icon: AlertCircle, color: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 font-semibold' },
};

export function PriorityBadge({ priority, size = 'sm', className = '' }) {
  const normalized = String(priority || '').toLowerCase();
  const config = PRIORITY_CONFIGS[normalized] || PRIORITY_CONFIGS.medium;
  const Icon = config.icon;

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs font-medium gap-1',
    md: 'px-2.5 py-1 text-xs font-semibold gap-1.5'
  }[size] || 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClasses} ${config.color} ${className}`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}

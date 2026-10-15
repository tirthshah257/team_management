import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from './Button.jsx';

export function FilterBar({ children, onReset, hasActiveFilters = false, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-subtle ${className}`}>
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
        <div className="text-slate-400 pl-1 shrink-0">
          <Filter className="w-4 h-4" />
        </div>
        {children}
      </div>

      {hasActiveFilters && onReset && (
        <Button
          variant="ghost"
          size="sm"
          icon={X}
          onClick={onReset}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
        >
          Reset filters
        </Button>
      )}
    </div>
  );
}

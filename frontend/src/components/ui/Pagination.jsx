import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './IconButton.jsx';

export function Pagination({
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
  className = ''
}) {
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  if (total <= pageSize && page === 1) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      <div>
        Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{startItem}</span> to{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{endItem}</span> of{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{total}</span> results
      </div>

      <div className="flex items-center gap-1.5">
        <IconButton
          icon={ChevronLeft}
          label="Previous page"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          Page {page} of {totalPages}
        </span>
        <IconButton
          icon={ChevronRight}
          label="Next page"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}

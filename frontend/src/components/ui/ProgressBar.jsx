import React from 'react';

export function ProgressBar({
  value = 0,
  max = 100,
  size = 'md',
  color = 'brand',
  showLabel = false,
  className = ''
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const sizeClasses = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  }[size] || 'h-2';

  let barColor = 'bg-brand-600';
  if (color === 'emerald' || percentage === 100) {
    barColor = 'bg-emerald-500';
  } else if (color === 'amber') {
    barColor = 'bg-amber-500';
  } else if (color === 'rose') {
    barColor = 'bg-rose-500';
  }

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs mb-1 font-medium">
          <span className="text-slate-500 dark:text-slate-400">Progress</span>
          <span className="text-slate-700 dark:text-slate-300 font-semibold">{percentage}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden ${sizeClasses}`}>
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin="0"
          aria-valuemax="100"
          style={{ width: `${percentage}%` }}
          className={`h-full transition-all duration-300 rounded-full ${barColor}`}
        />
      </div>
    </div>
  );
}

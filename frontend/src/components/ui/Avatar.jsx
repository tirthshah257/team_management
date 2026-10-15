import React from 'react';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name = '',
  color = '#4F46E5',
  size = 'md',
  className = '',
  showTooltip = false
}) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm font-semibold',
    xl: 'w-12 h-12 text-base font-bold'
  }[size] || 'w-8 h-8 text-xs';

  const initials = getInitials(name);

  return (
    <div
      title={showTooltip ? name : undefined}
      aria-label={name}
      style={{ backgroundColor: color }}
      className={`inline-flex items-center justify-center shrink-0 rounded-full text-white font-medium shadow-subtle select-none ${sizeClasses} ${className}`}
    >
      {initials}
    </div>
  );
}

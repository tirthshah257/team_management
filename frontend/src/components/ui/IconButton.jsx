import React from 'react';
import { Loader2 } from 'lucide-react';

export const IconButton = React.forwardRef(({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-2.5 text-base'
  }[size] || 'p-2 text-sm';

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }[size] || 'w-5 h-5';

  const variantClasses = {
    ghost: 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800',
    outline: 'border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    danger: 'text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40'
  }[variant] || 'text-slate-500';

  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-40 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes} animate-spin`} />
      ) : (
        <Icon className={iconSizes} />
      )}
    </button>
  );
});

IconButton.displayName = 'IconButton';

import React from 'react';

export function Table({ children, className = '' }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full text-left text-xs text-slate-600 dark:text-slate-300 border-collapse ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className = '' }) {
  return (
    <thead className={`bg-slate-50 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 ${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }) {
  return (
    <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 ${className}`}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', onClick, ...props }) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors ${
        onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className = '', ...props }) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}

export function TableHeaderCell({ children, className = '', ...props }) {
  return (
    <th className={`px-4 py-2.5 font-semibold whitespace-nowrap ${className}`} {...props}>
      {children}
    </th>
  );
}

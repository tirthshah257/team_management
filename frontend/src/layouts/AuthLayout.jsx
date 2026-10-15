import React from 'react';
import { Layers, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { IconButton } from '../components/ui/IconButton.jsx';

export function AuthLayout({ children, title, subtitle, sideContent }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative selection:bg-brand-500 selection:text-white">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <IconButton
          icon={isDark ? Sun : Moon}
          label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        />
      </div>

      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 dark:bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className={`w-full ${sideContent ? 'max-w-5xl' : 'max-w-md'} relative z-10 my-6`}>
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/30 mb-2">
            <Layers className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            TeamFlow
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Fast, unified team & project management system
          </p>
        </div>

        {sideContent ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Col: Main Login / Action Form */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 flex-1 flex flex-col justify-between">
                <div>
                  {title && (
                    <div className="mb-6">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {title}
                      </h2>
                      {subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  )}
                  {children}
                </div>
              </div>
            </div>

            {/* Right Col: Side Panel (All Members / Roles / Quick Login) */}
            <div className="lg:col-span-6 flex flex-col">
              {sideContent}
            </div>
          </div>
        ) : (
          /* Single Card mode */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-card p-6 sm:p-8">
            {title && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            {children}
          </div>
        )}

        <div className="text-center mt-6 text-xs text-slate-400 dark:text-slate-500">
          TeamFlow System &bull; Role-Based Access Control (RBAC) &bull; Secure Session
        </div>
      </div>
    </div>
  );
}

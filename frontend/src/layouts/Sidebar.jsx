import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Calendar,
  Users2,
  Clock,
  BarChart3,
  Users,
  UserCheck,
  CalendarOff,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Tooltip } from '../components/ui/Tooltip.jsx';

const NAV_ITEMS = [
  {
    group: 'Workspace',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'My Tasks', path: '/my-tasks', icon: CheckSquare },
      { name: 'Projects', path: '/projects', icon: FolderKanban },
      { name: 'Teams', path: '/teams', icon: Users },
      { name: 'Members', path: '/members', icon: UserCheck, roles: ['admin', 'manager'] },
    ]
  },
  {
    group: 'Planning & Time',
    items: [
      { name: 'Calendar', path: '/calendar', icon: Calendar },
      { name: 'Workload', path: '/workload', icon: Users2, roles: ['admin', 'manager'] },
      { name: 'Timesheets', path: '/timesheets', icon: Clock },
      { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['admin', 'manager'] },
    ]
  },
  {
    group: 'People & Organization',
    items: [
      { name: 'Attendance', path: '/attendance', icon: UserCheck },
      { name: 'Leave', path: '/leave', icon: CalendarOff },
      { name: 'Performance', path: '/performance', icon: TrendingUp },
      { name: 'Settings', path: '/settings', icon: Settings },
    ]
  }
];

export function Sidebar({
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen
}) {
  const { workspace, user } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-16' : 'lg:w-60'} w-64`}
      >
        {/* Workspace Brand / Header */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0 font-bold shadow-subtle">
              <Layers className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {workspace?.name || 'TeamFlow'}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {user?.role || 'Member'} Mode
                </div>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {NAV_ITEMS.map((group, groupIdx) => {
            const visibleItems = group.items.filter(item => !item.roles || item.roles.includes(user?.role));
            if (visibleItems.length === 0) return null;

            return (
              <div key={groupIdx} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {group.group}
                  </div>
                )}
                {visibleItems.map((item) => {
                const Icon = item.icon;
                const linkContent = (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-btn text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </NavLink>
                );

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.path} content={item.name} position="right">
                      {linkContent}
                    </Tooltip>
                  );
                }

                return linkContent;
              })}
            </div>
            );
          })}
        </div>

        {/* Collapse toggle button at bottom (desktop only) */}
        <div className="hidden lg:flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-1.5 rounded-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

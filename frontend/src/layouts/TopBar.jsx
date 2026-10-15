import React, { useState, useEffect } from 'react';
import { Menu, Search, Bell, Plus, Moon, Sun, User, LogOut, Users, Sparkles, Check, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { IconButton } from '../components/ui/IconButton.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Dropdown, DropdownItem } from '../components/ui/Dropdown.jsx';
import { NotificationDropdown } from '../components/notifications/NotificationDropdown.jsx';
import { GlobalTimerWidget } from '../components/time/GlobalTimerWidget.jsx';

export function TopBar({ onToggleMobileMenu, onOpenSearch, onQuickCreate }) {
  const { user, logout, quickLogin, getSystemMembers } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { success: toastSuccess, error: toastError } = useToast();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [membersList, setMembersList] = useState([]);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    if (switcherOpen) {
      getSystemMembers().then(data => {
        if (Array.isArray(data)) setMembersList(data);
      }).catch(() => {});
    }
  }, [switcherOpen, getSystemMembers]);

  const handleSwitchTo = async (targetUser) => {
    if (targetUser.id === user?.id) {
      setSwitcherOpen(false);
      return;
    }
    setIsSwitching(true);
    try {
      await quickLogin({ email: targetUser.email, userId: targetUser.id });
      toastSuccess(`Switched to ${targetUser.name}`, `Now acting as ${targetUser.role.toUpperCase()}`);
      setSwitcherOpen(false);
      window.location.reload();
    } catch (err) {
      toastError('Failed to switch user', err.message);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <>
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
        {/* Left: Mobile hamburger & Global Search Trigger */}
        <div className="flex items-center gap-3">
          <IconButton
            icon={Menu}
            label="Open navigation menu"
            onClick={onToggleMobileMenu}
            className="lg:hidden"
          />

          {/* Global Search Bar Button (Ctrl+K) */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-btn bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs transition-colors border border-transparent dark:border-slate-700/50 w-44 sm:w-64"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">Search tasks, projects...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-400">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Right: Quick actions, live stopwatch, notifications, user menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Member / Role Switcher Button (Admin only) */}
          {user?.role === 'admin' && (
            <button
              onClick={() => setSwitcherOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              title="Switch member or test RBAC roles"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span className="capitalize">{user?.role} Mode</span>
            </button>
          )}

          {/* Live Running Stopwatch Widget */}
          <GlobalTimerWidget />

          {/* Notification Dropdown with live unread badge */}
          <NotificationDropdown />

          {/* User profile dropdown */}
          <Dropdown
            align="right"
            trigger={
              <div className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-slate-200 dark:hover:ring-slate-700 transition-all">
                <Avatar
                  name={user?.name}
                  color={user?.avatar_color}
                  size="sm"
                />
              </div>
            }
          >
            <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user?.name}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {user?.email}
              </div>
              <div className="inline-block mt-1 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                {user?.role}
              </div>
            </div>

            <DropdownItem
              icon={ArrowRightLeft}
              onClick={() => setSwitcherOpen(true)}
            >
              Switch Member / Role
            </DropdownItem>

            <DropdownItem
              icon={isDark ? Sun : Moon}
              onClick={toggleTheme}
            >
              {isDark ? 'Light Theme' : 'Dark Theme'}
            </DropdownItem>

            <DropdownItem
              icon={User}
              onClick={() => window.location.href = '/settings'}
            >
              Profile & Settings
            </DropdownItem>

            <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

            <DropdownItem
              icon={LogOut}
              danger
              onClick={logout}
            >
              Log Out
            </DropdownItem>
          </Dropdown>
        </div>
      </header>

      {/* Quick Switch Member Modal */}
      {switcherOpen && (
        <Modal
          isOpen={true}
          onClose={() => setSwitcherOpen(false)}
          title="Switch Member / RBAC Role"
          description="Instantly switch to any team member in the workspace to view their perspective and permissions."
          maxWidth="max-w-md"
        >
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {membersList.map((m) => {
              const isCurrent = m.id === user?.id;
              const roleColor =
                m.role === 'admin'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : m.role === 'manager'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';

              return (
                <div
                  key={m.id}
                  onClick={() => !isCurrent && handleSwitchTo(m)}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 cursor-default'
                      : 'border-slate-200 dark:border-slate-800 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={m.name} color={m.avatar_color} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {m.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {m.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${roleColor}`}>
                      {m.role}
                    </span>
                    {isCurrent ? (
                      <span className="text-[11px] text-brand-600 dark:text-brand-400 font-bold flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={isSwitching}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchTo(m);
                        }}
                      >
                        Switch
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setSwitcherOpen(false)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

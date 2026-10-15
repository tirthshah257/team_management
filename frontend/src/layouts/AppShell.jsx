import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { MustChangePasswordModal } from '../pages/auth/MustChangePasswordModal.jsx';
import { SearchPalette } from '../components/search/SearchPalette.jsx';

export function AppShell() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { mustChangePassword } = useAuth();

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    const handleOpenSearchEvent = () => setIsSearchOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('teamflow:open-search', handleOpenSearchEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('teamflow:open-search', handleOpenSearchEvent);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main layout container adjusted for sidebar width */}
      <div className={`flex-1 flex flex-col transition-all duration-200 ${
        isCollapsed ? 'lg:pl-16' : 'lg:pl-60'
      }`}>
        {/* TopBar */}
        <TopBar
          onToggleMobileMenu={() => setMobileOpen(!mobileOpen)}
          onOpenSearch={() => window.dispatchEvent(new CustomEvent('teamflow:open-search'))}
          onQuickCreate={() => window.dispatchEvent(new CustomEvent('teamflow:quick-create'))}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Search Palette */}
      <SearchPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Must change password modal blocker */}
      {mustChangePassword && <MustChangePasswordModal />}
    </div>
  );
}

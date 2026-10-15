import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MembersPage } from '../pages/members/MembersPage.jsx';
import { TeamsPage } from '../pages/teams/TeamsPage.jsx';
import { ThemeProvider } from '../context/ThemeContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import * as AuthContextModule from '../context/AuthContext.jsx';
import { userService } from '../services/userService.js';
import { teamService } from '../services/teamService.js';

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            {ui}
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Phase 2: Frontend Members & Teams', () => {
  it('renders MembersPage with header and invite button for Admin', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, name: 'Admin Alice', role: 'admin' },
      isAuthenticated: true,
      isAdmin: true,
      isManager: false
    });

    vi.spyOn(userService, 'listUsers').mockResolvedValue({
      data: [{ id: 1, name: 'Admin Alice', email: 'admin@acme.test', role: 'admin', is_active: 1, capacity_hours_per_week: 40 }],
      meta: { total: 1, page: 1, pageSize: 15 }
    });

    renderWithProviders(<MembersPage />);

    expect(screen.getByText(/members & invitations/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /invite teammate/i })).toBeInTheDocument();
  });

  it('renders TeamsPage with team list and create button for Admin', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, name: 'Admin Alice', role: 'admin' },
      isAuthenticated: true,
      isAdmin: true,
      isManager: false
    });

    vi.spyOn(teamService, 'listTeams').mockResolvedValue([
      { id: 1, name: 'Engineering', description: 'Core devs', member_count: 5, active_project_count: 2 }
    ]);

    renderWithProviders(<TeamsPage />);

    expect(screen.getByRole('heading', { name: /^teams$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
  });
});

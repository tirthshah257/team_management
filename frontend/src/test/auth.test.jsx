import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage.jsx';
import { ThemeProvider } from '../context/ThemeContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import * as AuthContextModule from '../context/AuthContext.jsx';

function renderWithProviders(ui) {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          {ui}
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

describe('Frontend Auth Flow', () => {
  it('renders login form with email, password inputs and submit button', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      canRegister: false,
      login: vi.fn(),
    });

    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('displays initial setup banner when canRegister is true', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      canRegister: true,
      login: vi.fn(),
    });

    renderWithProviders(<LoginPage />);

    expect(screen.getByText(/initial setup required/i)).toBeInTheDocument();
    expect(screen.getByText(/create workspace & first admin/i)).toBeInTheDocument();
  });
});

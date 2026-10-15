import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [canRegister, setCanRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth session and workspace registration status on mount
  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const meRes = await apiClient.get('/auth/me');
      setUser(meRes.data.data.user);
      setWorkspace(meRes.data.data.workspace);
      setPreferences(meRes.data.data.preferences);
      setCanRegister(false);
    } catch (err) {
      setUser(null);
      setWorkspace(null);
      setPreferences(null);

      // Check if registration is open (empty database)
      try {
        const statusRes = await apiClient.get('/auth/status');
        setCanRegister(Boolean(statusRes.data.data?.canRegister));
      } catch (statusErr) {
        setCanRegister(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (credentials) => {
    const res = await apiClient.post('/auth/login', credentials);
    const { user: userData, workspace: wsData } = res.data.data;
    setUser(userData);
    setWorkspace(wsData);
    setCanRegister(false);
    // Refresh full details (including preferences)
    await checkAuth();
    return res.data.data;
  };

  const register = async (registrationData) => {
    const res = await apiClient.post('/auth/register', registrationData);
    const { user: userData, workspace: wsData } = res.data.data;
    setUser(userData);
    setWorkspace(wsData);
    setCanRegister(false);
    await checkAuth();
    return res.data.data;
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setWorkspace(null);
      setPreferences(null);
      // Recheck status if needed
      try {
        const statusRes = await apiClient.get('/auth/status');
        setCanRegister(Boolean(statusRes.data.data?.canRegister));
      } catch (e) {}
    }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    const res = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword
    });
    // If user must change password flag was active, refresh user
    if (user?.must_change_password) {
      await checkAuth();
    }
    return res.data.data;
  };

  const quickLogin = async (payload) => {
    const res = await apiClient.post('/auth/quick-login', payload);
    const { user: userData, workspace: wsData } = res.data.data;
    setUser(userData);
    setWorkspace(wsData);
    setCanRegister(false);
    await checkAuth();
    return res.data.data;
  };

  const getSystemMembers = async () => {
    const res = await apiClient.get('/auth/members');
    return res.data.data;
  };

  const value = {
    user,
    workspace,
    preferences,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    isMember: user?.role === 'member',
    mustChangePassword: Boolean(user?.must_change_password),
    canRegister,
    isLoading,
    login,
    quickLogin,
    getSystemMembers,
    register,
    logout,
    changePassword,
    refreshUser: checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

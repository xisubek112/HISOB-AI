/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types/finance.ts';
import { api } from '../services/api.ts';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, fullName: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Sync theme with DOM and localStorage
  const applyTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('hisobot_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    if (user) {
      api.updateProfile({ theme: next }).catch(() => {});
    }
  };

  const refreshUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
      if (data.user.theme) {
        applyTheme(data.user.theme);
      }
    } catch {
      api.setToken(null);
      await loginDemo();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedTheme = (localStorage.getItem('hisobot_theme') as 'light' | 'dark') || 'light';
    applyTheme(savedTheme);

    const token = api.getToken();
    if (token) {
      refreshUser();
    } else {
      // Auto-load demo user if no token exists for immediate frictionless app experience
      loginDemo().finally(() => setLoading(false));
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setUser(res.user);
    if (res.user.theme) applyTheme(res.user.theme);
  };

  const register = async (email: string, pass: string, fullName: string) => {
    const res = await api.register(email, pass, fullName);
    setUser(res.user);
    if (res.user.theme) applyTheme(res.user.theme);
  };

  const loginDemo = async () => {
    try {
      const res = await api.login('demo@hisobot.uz', 'hisobot123');
      setUser(res.user);
      if (res.user.theme) applyTheme(res.user.theme);
    } catch (e) {
      console.warn('Demo login failed:', e);
    }
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const updateUser = async (updates: Partial<UserProfile>) => {
    const res = await api.updateProfile(updates);
    setUser(res.user);
    if (updates.theme) applyTheme(updates.theme);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        theme,
        toggleTheme,
        login,
        register,
        loginDemo,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

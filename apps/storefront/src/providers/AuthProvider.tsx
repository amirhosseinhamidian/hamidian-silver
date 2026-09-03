'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { getCurrentUser } from '@hamidian/api-client';

import type { CurrentUserResponse, LoginResponse } from '@hamidian/types';

interface AuthContextValue {
  user: CurrentUserResponse | null;

  loading: boolean;

  login(response: LoginResponse): Promise<void>;

  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUserResponse | null>(null);

  const [loading, setLoading] = useState(true);

  async function login(response: LoginResponse) {
    localStorage.setItem('accessToken', response.accessToken);

    const currentUser = await getCurrentUser(response.accessToken);

    setUser(currentUser);
  }

  function logout() {
    localStorage.removeItem('accessToken');

    setUser(null);
  }

  useEffect(() => {
    async function initialize() {
      const token = localStorage.getItem('accessToken');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser(token);

        setUser(currentUser);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

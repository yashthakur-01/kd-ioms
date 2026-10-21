'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch, setAccessToken } from '../lib/api/client';

export interface AuthUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'RETAILER' | 'DELIVERY';
  phone?: string;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback((token: string, userData: AuthUser) => {
    setAccessToken(token);
    setUser(userData);
    if (typeof document !== 'undefined') {
      document.cookie = `userRole=${encodeURIComponent(userData.role)}; path=/; max-age=900; SameSite=Lax`;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore logout errors
    } finally {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
      if (typeof document !== 'undefined') {
        document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax';
        document.cookie = 'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax';
        document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax';
        document.cookie = 'refreshToken=; path=/api/v1/auth; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax';
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax';
      }
      router.replace('/login');
    }
  }, [queryClient, router]);

  // On initial mount, attempt silent refresh
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const refreshRes = await fetch('/api/v1/auth/refresh', { method: 'POST' });
        if (refreshRes.ok) {
          const json = await refreshRes.json();
          if (json.success && json.data?.accessToken) {
            setAccessToken(json.data.accessToken);
            const meRes = await apiFetch<AuthUser>('/auth/me');
            if (isMounted && meRes.success) {
              setUser(meRes.data);
              if (typeof document !== 'undefined') {
                document.cookie = `userRole=${encodeURIComponent(meRes.data.role)}; path=/; max-age=900; SameSite=Lax`;
              }
            }
          }
        } else {
          setAccessToken(null);
          setUser(null);
          if (typeof document !== 'undefined') {
            document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
            document.cookie = 'userRole=; path=/; max-age=0; SameSite=Lax';
          }
        }
      } catch {
        setAccessToken(null);
        setUser(null);
        if (typeof document !== 'undefined') {
          document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
          document.cookie = 'userRole=; path=/; max-age=0; SameSite=Lax';
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      isLoading: false,
      login: () => {},
      logout: async () => {},
      setUser: () => {},
    };
  }
  return context;
}

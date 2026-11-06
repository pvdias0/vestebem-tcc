import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type User } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser((await api.me()).user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setUser(null);
      else throw err;
    }
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [refresh]);

  const value: AuthState = {
    user,
    loading,
    refresh,
    login: async (email, password) => {
      const { user: u } = await api.login(email, password);
      setUser(u);
      return u;
    },
    register: async (name, email, password) => setUser((await api.register(name, email, password)).user),
    logout: async () => {
      await api.logout();
      setUser(null);
    },
  };
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

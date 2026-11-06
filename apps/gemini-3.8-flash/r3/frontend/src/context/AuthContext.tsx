import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, type User } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const data = await api.login(email, password);
      setUser(data.user);
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar.');
      throw err;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setError(null);
    try {
      const data = await api.register(name, email, password);
      setUser(data.user);
    } catch (err: any) {
      setError(err.message || 'Falha ao realizar cadastro.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Erro ao sair:', err);
    } finally {
      setUser(null);
    }
  };

  const clearError = () => setError(null);

  const refreshUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
    } catch {
      // Ignora erro de refresh
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, refreshUser, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}

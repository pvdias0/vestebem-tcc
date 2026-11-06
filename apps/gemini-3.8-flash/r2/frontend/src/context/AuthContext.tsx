import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UpdateProfileInput, UpdateAddressInput, ChangePasswordInput } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  registerUser: (name: string, email: string, passwordPlain: string) => Promise<void>;
  loginUser: (email: string, passwordPlain: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  updateProfile: (data: UpdateProfileInput) => Promise<void>;
  updateAddress: (data: UpdateAddressInput) => Promise<void>;
  changePassword: (data: ChangePasswordInput) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const response = await api.getMe();
      setUser(response.user);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      try {
        await refreshUser();
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const registerUser = async (name: string, email: string, passwordPlain: string) => {
    const res = await api.register(name, email, passwordPlain);
    setUser(res.user);
  };

  const loginUser = async (email: string, passwordPlain: string) => {
    const res = await api.login(email, passwordPlain);
    setUser(res.user);
  };

  const logoutUser = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (data: UpdateProfileInput) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
  };

  const updateAddress = async (data: UpdateAddressInput) => {
    const res = await api.updateAddress(data);
    setUser((prev) => (prev ? { ...prev, address: res.address } : null));
  };

  const changePassword = async (data: ChangePasswordInput) => {
    await api.changePassword(data);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        registerUser,
        loginUser,
        logoutUser,
        updateProfile,
        updateAddress,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}

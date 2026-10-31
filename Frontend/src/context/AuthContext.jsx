import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  }, []);

  // Restore session on mount if token exists
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const res = await authService.getMe();
          if (isMounted) {
            if (res.success && res.data && res.data.user) {
              setUser(res.data.user);
              setToken(storedToken);
            } else {
              logout();
            }
          }
        } catch (err) {
          console.warn('Session restoration failed:', err?.response?.data?.message || err.message);
          if (isMounted) {
            logout();
          }
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  const login = async (credentials) => {
    const res = await authService.login(credentials);
    if (res.success && res.data) {
      const { user: userData, token: jwtToken } = res.data;
      localStorage.setItem('token', jwtToken);
      setUser(userData);
      setToken(jwtToken);
      return userData;
    }
    throw new Error(res.message || 'Login failed.');
  };

  const register = async (userData) => {
    const res = await authService.register(userData);
    if (res.success && res.data) {
      const { user: newUser, token: jwtToken } = res.data;
      localStorage.setItem('token', jwtToken);
      setUser(newUser);
      setToken(jwtToken);
      return newUser;
    }
    throw new Error(res.message || 'Registration failed.');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

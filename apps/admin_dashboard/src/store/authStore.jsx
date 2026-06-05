import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('airride_admin');
    const token = localStorage.getItem('airride_admin_token');
    if (stored && token) setAdmin(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    localStorage.setItem('airride_admin_token', res.data.token);
    localStorage.setItem('airride_admin', JSON.stringify(res.data.admin));
    setAdmin(res.data.admin);
  };

  const logout = () => {
    localStorage.removeItem('airride_admin_token');
    localStorage.removeItem('airride_admin');
    setAdmin(null);
  };

  return <AuthContext.Provider value={{ admin, login, logout, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

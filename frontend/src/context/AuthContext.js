import React, { createContext, useContext, useState } from 'react';
import { login as loginApi, logout as logoutApi } from '../api/endpoints';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [email, setEmail] = useState(localStorage.getItem('pm_email'));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthenticated = Boolean(localStorage.getItem('pm_token'));

  const login = async (emailInput, password) => {
    setIsSubmitting(true);
    setError('');
    try {
      const data = await loginApi(emailInput, password);
      setEmail(data.email);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = () => {
    logoutApi();
    setEmail(null);
  };

  return (
    <AuthContext.Provider value={{ email, isAuthenticated, login, logout, error, isSubmitting }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

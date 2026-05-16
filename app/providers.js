'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('healthy'); // healthy, warning, error
  const [welcomeShownInThisSession, setWelcomeShownInThisSession] = useState(false);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('user');
    // Le token est maintenant géré via un cookie HttpOnly sécurisé
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    const handleStatusChange = (e) => {
      setApiStatus(e.detail);
    };

    window.addEventListener('api-status-change', handleStatusChange);

    setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => {
      window.removeEventListener('api-status-change', handleStatusChange);
    };
  }, []);

  const login = (userData) => {
    setUser(userData.user);
    sessionStorage.removeItem('welcomeShown'); // Ensure welcome shows on next dashboard visit
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('welcomeShown');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user, 
      loading,
      apiStatus,
      setApiStatus
    }}>
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

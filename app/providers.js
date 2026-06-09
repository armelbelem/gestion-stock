'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('healthy'); // healthy, warning, error
  const [welcomeShownInThisSession, setWelcomeShownInThisSession] = useState(false);

  useEffect(() => {
    // Utiliser uniquement sessionStorage pour que la session expire à la fermeture du navigateur
    const savedUser = sessionStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        sessionStorage.removeItem('user');
      }
    } else {
      localStorage.removeItem('user'); // Nettoyage de l'ancien mécanisme
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

  // Renouvellement automatique du token toutes les 30 minutes si l'utilisateur est actif
  useEffect(() => {
    if (!user) return;

    const refreshToken = async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          // Mettre à jour les infos utilisateur en local si elles ont changé
          if (data.user) {
            sessionStorage.setItem('user', JSON.stringify(data.user));
            setUser(data.user);
          }
        } else if (res.status === 401) {
          // Token vraiment expiré → déconnexion propre
          logout();
        }
      } catch (e) {
        console.warn('[Token refresh silencieux échoué]', e);
      }
    };

    // Refresh toutes les 30 minutes (1 800 000 ms)
    const interval = setInterval(refreshToken, 30 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const login = (userData) => {
    setUser(userData.user);
    sessionStorage.setItem('user', JSON.stringify(userData.user));
    localStorage.removeItem('user'); // Nettoyage ancien mécanisme
    sessionStorage.removeItem('welcomeShown');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
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

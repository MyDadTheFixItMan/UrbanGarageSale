// src/lib/__mocks__/AuthContext.jsx
import React from 'react';

export const AuthContext = React.createContext();

export const AuthProvider = ({ children }) => {
  const value = {
    user: { id: 'user_123', email: 'user@example.com', role: 'user' },
    isAuthenticated: true,
    isLoadingAuth: false,
    login: () => {},
    logout: () => {},
    register: () => {},
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return {
    user: { id: 'user_123', email: 'user@example.com', role: 'user' },
    isAuthenticated: true,
    isLoadingAuth: false,
    login: () => {},
    logout: () => {},
    register: () => {},
  };
};


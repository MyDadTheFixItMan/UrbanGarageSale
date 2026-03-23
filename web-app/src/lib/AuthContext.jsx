import React, { createContext, useState, useContext, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAppState();
    
    // Listen to auth state changes
    const unsubscribe = firebase.auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        try {
          const userData = await firebase.auth.me();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          console.warn('⚠️ Failed to get user profile:', error.message);
          // Still consider user authenticated even if profile fetch fails
          setUser({ id: authUser.uid, email: authUser.email });
          setIsAuthenticated(true);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
      setIsLoadingAuth(false);
    });
    
    return unsubscribe;
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // Check if user is authenticated
      const isAuth = await firebase.auth.isAuthenticated();
      
      if (isAuth) {
        try {
          const currentUser = await firebase.auth.me();
          setUser(currentUser);
          setIsAuthenticated(true);
        } catch (error) {
          console.warn('⚠️ Failed to get user profile:', error.message);
          // Still set authenticated if we have a current user in auth system
          const authUser = firebase.currentUser;
          if (authUser) {
            setUser({ id: authUser.uid, email: authUser.email });
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
      
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    } catch (error) {
      console.warn('⚠️ Error checking app state:', error.message);
      // Don't block the app on errors - allow it to continue
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthError(null); // Don't show error UI for transient issues
    }
  };

  const logout = async () => {
    try {
      await firebase.auth.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

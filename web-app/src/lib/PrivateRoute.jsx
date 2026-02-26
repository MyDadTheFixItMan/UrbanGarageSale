import React from 'react';
import { useAuth } from './AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * PrivateRoute Component
 * Protects routes that require authentication
 * Shows loading spinner while checking auth, redirects to login if not authenticated
 */
export default function PrivateRoute({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  return children;
}

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // ✅ Safety fallback: if loading takes too long, show basic message after timeout
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-600">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <p className="text-sm">Checking authentication...</p>
      </div>
    );
  }

  // ✅ If user is not logged in, redirect to login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // ✅ Otherwise, render the protected content
  return <>{children}</>;
}

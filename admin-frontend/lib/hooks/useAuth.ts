/**
 * useAuth Hook
 * Manages authentication state and provides auth utilities
 * 
 * Requirement 15.4: Monitor session state
 * Requirement 15.7: Handle session expiration
 */

'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth, onAuthChange, logout as firebaseLogout } from '@/lib/auth/firebase';

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

/**
 * Hook to manage authentication state
 * Requirement 15.4: Monitor session state
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      // Listen to auth state changes
      const unsubscribe = onAuthChange((authUser) => {
        setUser(authUser);
        setLoading(false);
        setError(null);
      });

      return () => unsubscribe();
    } catch (err) {
      const error = new Error('Failed to set up auth listener');
      setError(error);
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    try {
      await firebaseLogout();
      setUser(null);
    } catch (err) {
      const error = new Error('Failed to logout');
      setError(error);
      throw error;
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (err) {
      console.error('Failed to get ID token:', err);
      return null;
    }
  };

  return {
    user,
    loading,
    error,
    logout,
    getIdToken,
  };
}

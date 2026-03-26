/**
 * useAuth Hook for Authentication State Management
 * Requirement 15.2: Admin_Frontend SHALL integrate with Firebase Authentication
 * Requirement 15.4: Admin_Frontend SHALL store the session token securely
 */

'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth, onAuthChange } from './firebase';

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Custom hook for managing authentication state
 * Automatically subscribes to Firebase auth state changes
 * 
 * @returns {UseAuthReturn} Current user, loading state, and any errors
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, loading } = useAuth();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (!user) return <div>Please login</div>;
 *   
 *   return <div>Welcome {user.email}</div>;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      // Subscribe to auth state changes
      const unsubscribe = onAuthChange((user) => {
        setUser(user);
        setLoading(false);
      });

      // Cleanup subscription on unmount
      return unsubscribe;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Authentication error'));
      setLoading(false);
    }
  }, []);

  return { user, loading, error };
}

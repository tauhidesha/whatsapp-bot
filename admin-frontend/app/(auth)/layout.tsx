/**
 * Auth Layout Component
 * Task 2.2: Implement authentication middleware and protected routes
 * 
 * This layout wraps the login page and ensures authenticated users
 * are redirected to the dashboard.
 * 
 * Requirements:
 * - 15.1: Require authentication before displaying business data
 * - 15.3: Redirect authenticated users to dashboard
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (!loading && user) {
      router.push('/conversations');
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, don't show login page (redirect will happen)
  if (user) {
    return null;
  }

  // Show login page for unauthenticated users
  return <>{children}</>;
}

/**
 * Login Page Component
 * Task 2.1: Create login page with Firebase authentication
 * 
 * Requirements:
 * - 15.3: Support Google authentication
 * - 15.4: Store session token securely
 * - 16.3: Handle authentication errors with user-friendly messages
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginWithGoogle } from '@/lib/auth/firebase';
import { FirebaseError } from 'firebase/app';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for session expiration message
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setSessionExpiredMessage('Sesi Anda telah berakhir. Silakan masuk kembali.');
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    setError(null);
    setSessionExpiredMessage(null);
    setIsLoading(true);

    try {
      // Attempt login with Google
      await loginWithGoogle();
      
      // Redirect to dashboard on success
      router.push('/conversations');
    } catch (err) {
      // Handle authentication errors with user-friendly messages
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/popup-closed-by-user':
            setError('Login dibatalkan. Silakan coba lagi.');
            break;
          case 'auth/popup-blocked':
            setError('Popup diblokir browser. Silakan izinkan popup dan coba lagi.');
            break;
          case 'auth/cancelled-popup-request':
            setError('Login dibatalkan. Silakan coba lagi.');
            break;
          case 'auth/network-request-failed':
            setError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
            break;
          case 'auth/too-many-requests':
            setError('Terlalu banyak percobaan login. Silakan coba lagi nanti.');
            break;
          case 'auth/user-disabled':
            setError('Akun ini telah dinonaktifkan.');
            break;
          default:
            setError('Terjadi kesalahan saat login. Silakan coba lagi.');
        }
      } else {
        setError('Terjadi kesalahan yang tidak diketahui');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 border">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">account_balance_wallet</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Bosmat Admin
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              Masuk ke dashboard admin
            </p>
          </div>

          {/* Session Expired Alert */}
          {sessionExpiredMessage && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-sm">warning</span>
                <p className="text-sm text-amber-800">{sessionExpiredMessage}</p>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-sm">error</span>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-300 border-t-primary rounded-full animate-spin"></div>
                <span className="text-slate-700 font-medium">Memproses...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-slate-700 font-medium">Masuk dengan Google</span>
              </>
            )}
          </button>

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Hanya admin yang memiliki akses dapat masuk
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-600 mt-6">
          Bosmat Repainting & Detailing Studio
        </p>
      </div>
    </div>
  );
}

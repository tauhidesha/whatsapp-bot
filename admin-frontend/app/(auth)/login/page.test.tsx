/**
 * Unit Tests for Login Page
 * Task 2.1: Create login page with Firebase authentication
 * 
 * Tests:
 * - Form validation (email and password)
 * - Authentication error handling
 * - Loading state during authentication
 * - Successful login flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginPage from './page';
import * as firebaseAuth from '@/lib/auth/firebase';
import { FirebaseError } from 'firebase/app';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock Firebase auth
vi.mock('@/lib/auth/firebase', () => ({
  login: vi.fn(),
}));

describe('LoginPage', () => {
  const mockPush = vi.fn();
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
    });
    // Mock useSearchParams to return null by default
    vi.mocked(useSearchParams).mockReturnValue({
      get: vi.fn(() => null),
    } as any);
    (firebaseAuth.login as ReturnType<typeof vi.fn>) = mockLogin;
  });

  describe('Form Rendering', () => {
    it('should render login form with email and password inputs', () => {
      render(<LoginPage />);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /masuk/i })).toBeInTheDocument();
    });

    it('should render page title and description', () => {
      render(<LoginPage />);

      expect(screen.getByText('Bosmat Admin')).toBeInTheDocument();
      expect(screen.getByText('Masuk ke dashboard admin')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when email is empty', async () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.blur(emailInput);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email wajib diisi')).toBeInTheDocument();
      });
    });

    it('should show error when email format is invalid on blur', async () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('Format email tidak valid')).toBeInTheDocument();
      });
    });

    it('should show error when password is empty', async () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.blur(passwordInput);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password wajib diisi')).toBeInTheDocument();
      });
    });

    it('should show error when password is too short', async () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(passwordInput, { target: { value: '12345' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password minimal 6 karakter')).toBeInTheDocument();
      });
    });

    it('should clear validation errors when input is corrected', async () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);

      // Trigger error
      fireEvent.change(emailInput, { target: { value: 'invalid' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('Format email tidak valid')).toBeInTheDocument();
      });

      // Fix error
      fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });

      await waitFor(() => {
        expect(screen.queryByText('Format email tidak valid')).not.toBeInTheDocument();
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should call login function with correct credentials', async () => {
      mockLogin.mockResolvedValue(undefined);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should redirect to conversations page on successful login', async () => {
      mockLogin.mockResolvedValue(undefined);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/conversations');
      });
    });

    it('should show loading state during authentication', async () => {
      mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Check loading state
      expect(screen.getByText('Memproses...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText('Memproses...')).not.toBeInTheDocument();
      });
    });

    it('should disable form inputs during authentication', async () => {
      mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Check disabled state
      expect(emailInput.disabled).toBe(true);
      expect(passwordInput.disabled).toBe(true);

      await waitFor(() => {
        expect(emailInput.disabled).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display user-friendly error for invalid credentials', async () => {
      const error = new FirebaseError('auth/invalid-credential', 'Invalid credentials');
      mockLogin.mockRejectedValue(error);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email atau password salah')).toBeInTheDocument();
      });
    });

    it('should display error for disabled account', async () => {
      const error = new FirebaseError('auth/user-disabled', 'User disabled');
      mockLogin.mockRejectedValue(error);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Akun ini telah dinonaktifkan')).toBeInTheDocument();
      });
    });

    it('should display error for too many requests', async () => {
      const error = new FirebaseError('auth/too-many-requests', 'Too many requests');
      mockLogin.mockRejectedValue(error);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Terlalu banyak percobaan login. Silakan coba lagi nanti')).toBeInTheDocument();
      });
    });

    it('should display error for network failure', async () => {
      const error = new FirebaseError('auth/network-request-failed', 'Network error');
      mockLogin.mockRejectedValue(error);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Tidak dapat terhubung ke server. Periksa koneksi internet Anda')).toBeInTheDocument();
      });
    });

    it('should display generic error for unknown errors', async () => {
      const error = new Error('Unknown error');
      mockLogin.mockRejectedValue(error);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Terjadi kesalahan yang tidak diketahui')).toBeInTheDocument();
      });
    });

    it('should clear previous error when submitting again', async () => {
      const error = new FirebaseError('auth/invalid-credential', 'Invalid credentials');
      mockLogin.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      // First attempt - fail
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email atau password salah')).toBeInTheDocument();
      });

      // Second attempt - success
      fireEvent.change(passwordInput, { target: { value: 'correctpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Email atau password salah')).not.toBeInTheDocument();
      });
    });
  });
});

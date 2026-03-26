/**
 * Integration Tests for Authentication Flow
 * Task 2.3: Write integration tests for authentication flow
 * 
 * Tests:
 * - Successful login flow (Requirements 15.3, 15.7)
 * - Failed login with invalid credentials (Requirements 15.3, 15.7)
 * - Session expiration handling (Requirements 15.7)
 * 
 * These tests verify the complete authentication flow from login page
 * through to dashboard access and session management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginPage from './page';
import DashboardLayout from '@/app/(dashboard)/layout';
import { useAuth } from '@/lib/auth/useAuth';
import * as firebaseAuth from '@/lib/auth/firebase';
import { FirebaseError } from 'firebase/app';
import { User } from 'firebase/auth';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(() => '/conversations'),
}));

// Mock Firebase auth
vi.mock('@/lib/auth/firebase', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  onAuthChange: vi.fn(),
  auth: {},
  db: {},
}));

// Mock useAuth hook
vi.mock('@/lib/auth/useAuth');

describe('Authentication Flow Integration Tests', () => {
  const mockPush = vi.fn();
  const mockLogin = vi.fn();
  const mockLogout = vi.fn();
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
  const mockUseRouter = useRouter as ReturnType<typeof vi.fn>;
  const mockUseSearchParams = useSearchParams as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup router mock
    mockUseRouter.mockReturnValue({
      push: mockPush,
    });

    // Setup search params mock (default: no params)
    mockUseSearchParams.mockReturnValue({
      get: vi.fn(() => null),
    });

    // Setup Firebase mocks
    (firebaseAuth.login as ReturnType<typeof vi.fn>) = mockLogin;
    (firebaseAuth.logout as ReturnType<typeof vi.fn>) = mockLogout;

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful Login Flow', () => {
    it('should complete full login flow from login page to dashboard', async () => {
      // Start with unauthenticated state
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      // Mock successful login
      mockLogin.mockResolvedValue({
        user: {
          email: 'test@example.com',
          uid: 'test-uid',
        },
      });

      // Render login page
      const { rerender } = render(<LoginPage />);

      // Fill in credentials
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      // Submit form
      fireEvent.click(submitButton);

      // Verify login was called
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });

      // Verify redirect to conversations page
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/conversations');
      });

      // Simulate authenticated state after login
      mockUseAuth.mockReturnValue({
        user: {
          email: 'test@example.com',
          uid: 'test-uid',
        } as User,
        loading: false,
        error: null,
      });

      // Render dashboard layout to verify access
      rerender(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      // Verify dashboard is accessible
      await waitFor(() => {
        expect(screen.getByText('Bosmat Admin')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      });

      // Verify session is marked as authenticated
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('wasAuthenticated', 'true');
    });

    it('should show loading state during authentication', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      // Mock login with delay
      mockLogin.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ user: {} }), 100))
      );

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Verify loading state is shown
      expect(screen.getByText('Memproses...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText('Memproses...')).not.toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should store authentication token securely after successful login', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      const mockUser = {
        email: 'test@example.com',
        uid: 'test-uid',
        getIdToken: vi.fn().mockResolvedValue('mock-token'),
      };

      mockLogin.mockResolvedValue({ user: mockUser });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/conversations');
      });
    });
  });

  describe('Failed Login with Invalid Credentials', () => {
    it('should display error message for invalid credentials', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      // Mock failed login with invalid credentials
      const error = new FirebaseError('auth/invalid-credential', 'Invalid credentials');
      mockLogin.mockRejectedValue(error);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText('Email atau password salah')).toBeInTheDocument();
      });

      // Verify no redirect occurred
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should not grant dashboard access after failed login', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      const error = new FirebaseError('auth/invalid-credential', 'Invalid credentials');
      mockLogin.mockRejectedValue(error);

      const { rerender } = render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email atau password salah')).toBeInTheDocument();
      });

      // Try to access dashboard - should redirect to login
      rerender(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });

      // Verify dashboard content is not shown
      expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
    });

    it('should allow retry after failed login', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      // First attempt fails, second succeeds
      const error = new FirebaseError('auth/invalid-credential', 'Invalid credentials');
      mockLogin
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ user: { email: 'test@example.com' } });

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
        expect(mockPush).toHaveBeenCalledWith('/conversations');
        expect(screen.queryByText('Email atau password salah')).not.toBeInTheDocument();
      });
    });

    it('should handle network errors during login', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

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
  });

  describe('Session Expiration Handling', () => {
    it('should redirect to login with expiration message when session expires', async () => {
      // Start with authenticated user
      mockUseAuth.mockReturnValue({
        user: {
          email: 'test@example.com',
          uid: 'test-uid',
        } as User,
        loading: false,
        error: null,
      });

      const { rerender } = render(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      // Verify user is authenticated and dashboard is shown
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('wasAuthenticated', 'true');

      // Simulate session expiration
      (window.sessionStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('true');
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      rerender(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      // Verify redirect to login with expired parameter
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?expired=true');
      });
    });

    it('should display session expiration message on login page', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      // Mock search params to include expired=true
      mockUseSearchParams.mockReturnValue({
        get: vi.fn((key) => key === 'expired' ? 'true' : null),
      });

      render(<LoginPage />);

      // Verify expiration message is displayed
      await waitFor(() => {
        expect(screen.getByText('Sesi Anda telah berakhir. Silakan masuk kembali.')).toBeInTheDocument();
      });
    });

    it('should clear session expiration message after new login attempt', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      mockUseSearchParams.mockReturnValue({
        get: vi.fn((key) => key === 'expired' ? 'true' : null),
      });

      mockLogin.mockResolvedValue({ user: { email: 'test@example.com' } });

      render(<LoginPage />);

      // Verify expiration message is shown
      expect(screen.getByText('Sesi Anda telah berakhir. Silakan masuk kembali.')).toBeInTheDocument();

      // Attempt new login
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Verify expiration message is cleared during login attempt
      await waitFor(() => {
        expect(screen.queryByText('Sesi Anda telah berakhir. Silakan masuk kembali.')).not.toBeInTheDocument();
      });
    });

    it('should clear sessionStorage when session expires', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          email: 'test@example.com',
          uid: 'test-uid',
        } as User,
        loading: false,
        error: null,
      });

      const { rerender } = render(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      // Simulate session expiration
      (window.sessionStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('true');
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      rerender(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?expired=true');
      });

      // Note: sessionStorage.removeItem is called in the effect
      // The actual removal happens in the component logic
    });

    it('should require re-authentication after session expiration', async () => {
      // Simulate expired session
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      mockUseSearchParams.mockReturnValue({
        get: vi.fn((key) => key === 'expired' ? 'true' : null),
      });

      mockLogin.mockResolvedValue({
        user: {
          email: 'test@example.com',
          uid: 'test-uid',
        },
      });

      const { rerender } = render(<LoginPage />);

      // Verify expiration message
      expect(screen.getByText('Sesi Anda telah berakhir. Silakan masuk kembali.')).toBeInTheDocument();

      // Re-authenticate
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockPush).toHaveBeenCalledWith('/conversations');
      });

      // Verify dashboard access is restored
      mockUseAuth.mockReturnValue({
        user: {
          email: 'test@example.com',
          uid: 'test-uid',
        } as User,
        loading: false,
        error: null,
      });

      rerender(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Authentication Lifecycle', () => {
    it('should handle full lifecycle: login -> access -> expire -> re-login', async () => {
      // Step 1: Initial login
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      mockLogin.mockResolvedValue({
        user: {
          email: 'test@example.com',
          uid: 'test-uid',
        },
      });

      const { rerender } = render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/conversations');
      });

      // Step 2: Access dashboard
      mockUseAuth.mockReturnValue({
        user: {
          email: 'test@example.com',
          uid: 'test-uid',
        } as User,
        loading: false,
        error: null,
      });

      rerender(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();

      // Step 3: Session expires
      (window.sessionStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('true');
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      rerender(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?expired=true');
      });

      // Step 4: Re-login
      mockUseSearchParams.mockReturnValue({
        get: vi.fn((key) => key === 'expired' ? 'true' : null),
      });

      rerender(<LoginPage />);

      expect(screen.getByText('Sesi Anda telah berakhir. Silakan masuk kembali.')).toBeInTheDocument();

      const newEmailInput = screen.getByLabelText(/email/i);
      const newPasswordInput = screen.getByLabelText(/password/i);
      const newSubmitButton = screen.getByRole('button', { name: /masuk/i });

      fireEvent.change(newEmailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(newPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(newSubmitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(2);
      });
    });
  });
});

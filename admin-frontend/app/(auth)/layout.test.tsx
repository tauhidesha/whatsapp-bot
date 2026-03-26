/**
 * Auth Layout Tests
 * Task 2.2: Test authentication middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AuthLayout from './layout';
import { useAuth } from '@/lib/auth/useAuth';
import { useRouter } from 'next/navigation';

// Mock dependencies
vi.mock('@/lib/auth/useAuth');
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock Firebase to prevent initialization errors in tests
vi.mock('@/lib/auth/firebase', () => ({
  auth: {},
  db: {},
  login: vi.fn(),
  logout: vi.fn(),
  onAuthChange: vi.fn(),
}));

describe('AuthLayout', () => {
  const mockPush = vi.fn();
  const mockUseRouter = useRouter as ReturnType<typeof vi.fn>;
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
  });

  it('shows loading state while checking authentication', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      error: null,
    });

    render(
      <AuthLayout>
        <div>Login Page</div>
      </AuthLayout>
    );

    expect(screen.getByText('Memuat...')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects authenticated users to conversations page', async () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    render(
      <AuthLayout>
        <div>Login Page</div>
      </AuthLayout>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/conversations');
    });
  });

  it('shows login page for unauthenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      error: null,
    });

    render(
      <AuthLayout>
        <div>Login Page</div>
      </AuthLayout>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not render children while loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      error: null,
    });

    render(
      <AuthLayout>
        <div>Login Page</div>
      </AuthLayout>
    );

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('does not render children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    render(
      <AuthLayout>
        <div>Login Page</div>
      </AuthLayout>
    );

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});

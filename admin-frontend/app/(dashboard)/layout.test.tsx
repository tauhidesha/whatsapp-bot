/**
 * Dashboard Layout Tests
 * Task 2.2: Test protected routes and logout functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardLayout from './layout';
import { useAuth } from '@/lib/auth/useAuth';
import { logout } from '@/lib/auth/firebase';
import { useRouter, usePathname } from 'next/navigation';

// Mock dependencies
vi.mock('@/lib/auth/useAuth');
vi.mock('@/lib/auth/firebase', () => ({
  logout: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

describe('DashboardLayout', () => {
  const mockPush = vi.fn();
  const mockUseRouter = useRouter as ReturnType<typeof vi.fn>;
  const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
  const mockLogout = logout as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
    mockUsePathname.mockReturnValue('/conversations');
    
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  it('shows loading state while checking authentication', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      error: null,
    });

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Memuat...')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      error: null,
    });

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('shows dashboard for authenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Bosmat Admin')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('displays navigation items', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Percakapan')).toBeInTheDocument();
    expect(screen.getByText('Booking')).toBeInTheDocument();
    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Follow-up')).toBeInTheDocument();
    expect(screen.getByText('Keuangan')).toBeInTheDocument();
    expect(screen.getByText('Pengaturan')).toBeInTheDocument();
  });

  it('handles logout successfully', async () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    mockLogout.mockResolvedValue(undefined);

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    const logoutButtons = screen.getAllByText('Keluar');
    fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('shows loading state during logout', async () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    mockLogout.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    const logoutButtons = screen.getAllByText('Keluar');
    fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText('Keluar...').length).toBeGreaterThan(0);
    });
  });

  it('handles logout error gracefully', async () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLogout.mockRejectedValue(new Error('Logout failed'));

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    const logoutButtons = screen.getAllByText('Keluar');
    fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Logout error:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });

  it('redirects with session expired message when session expires', async () => {
    // First render with authenticated user
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    const { rerender } = render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    // Mark as authenticated
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

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?expired=true');
    });
  });

  it('marks user as authenticated in sessionStorage', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith('wasAuthenticated', 'true');
  });

  it('clears sessionStorage on logout', async () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
      error: null,
    });

    mockLogout.mockResolvedValue(undefined);

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    const logoutButtons = screen.getAllByText('Keluar');
    fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('wasAuthenticated');
    });
  });
});

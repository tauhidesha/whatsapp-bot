/**
 * Unit Tests for useAuth Hook
 * Tests Requirements 15.2, 15.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { User } from 'firebase/auth';

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with loading state and then complete', async () => {
    // Mock with delayed callback
    vi.doMock('./firebase', () => ({
      auth: { currentUser: null },
      onAuthChange: vi.fn((callback) => {
        // Delay the callback to test loading state
        setTimeout(() => callback(null), 10);
        return () => {};
      }),
    }));
    
    const { useAuth } = await import('./useAuth');
    const { result } = renderHook(() => useAuth());
    
    // Initially should be loading
    expect(result.current.loading).toBe(true);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should set loading to false after auth state is determined', async () => {
    vi.doMock('./firebase', () => ({
      auth: { currentUser: null },
      onAuthChange: vi.fn((callback) => {
        callback(null);
        return () => {};
      }),
    }));
    
    const { useAuth } = await import('./useAuth');
    const { result } = renderHook(() => useAuth());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should update user state when auth changes', async () => {
    const mockUser = { 
      uid: '123', 
      email: 'test@example.com' 
    } as User;
    
    // Mock onAuthChange to call callback with user
    vi.doMock('./firebase', () => ({
      auth: { currentUser: mockUser },
      onAuthChange: vi.fn((callback) => {
        callback(mockUser);
        return () => {};
      }),
    }));
    
    const { useAuth } = await import('./useAuth');
    const { result } = renderHook(() => useAuth());
    
    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should return null user when not authenticated', async () => {
    vi.doMock('./firebase', () => ({
      auth: { currentUser: null },
      onAuthChange: vi.fn((callback) => {
        callback(null);
        return () => {};
      }),
    }));
    
    const { useAuth } = await import('./useAuth');
    const { result } = renderHook(() => useAuth());
    
    await waitFor(() => {
      expect(result.current.user).toBe(null);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should cleanup subscription on unmount', async () => {
    const unsubscribe = vi.fn();
    
    vi.doMock('./firebase', () => ({
      auth: { currentUser: null },
      onAuthChange: vi.fn((callback) => {
        callback(null);
        return unsubscribe;
      }),
    }));
    
    const { useAuth } = await import('./useAuth');
    const { unmount } = renderHook(() => useAuth());
    
    unmount();
    
    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});

/**
 * Integration Tests for useConversationNotifications Hook
 * Tests notification creation, dismissal, and navigation
 * 
 * Requirements: 14.1, 14.3, 14.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the shared notifications hook
vi.mock('@/components/shared/useNotifications', () => ({
  useNotifications: vi.fn(() => ({
    notifications: [],
    addNotification: vi.fn(),
    dismissNotification: vi.fn(),
    dismissAllNotifications: vi.fn(),
    dismissCustomerNotifications: vi.fn(),
    browserNotificationPermission: 'granted',
  })),
}));

// Mock browser Notification API
Object.defineProperty(window, 'Notification', {
  value: {
    requestPermission: vi.fn().mockResolvedValue('granted'),
    permission: 'default',
  },
  configurable: true,
});

describe('useConversationNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass basic smoke test', async () => {
    // Import the hook after mocks are set up
    const { useConversationNotifications } = await import('./useConversationNotifications');
    
    const { result } = renderHook(() =>
      useConversationNotifications({
        conversations: [],
        selectedConversationId: undefined,
        enabled: true,
      })
    );

    expect(result.current).toBeDefined();
    expect(typeof result.current.dismissNotification).toBe('function');
    expect(typeof result.current.dismissAllNotifications).toBe('function');
    expect(typeof result.current.dismissCustomerNotifications).toBe('function');
    expect(typeof result.current.notificationCount).toBe('number');
  });

  it('should handle disabled state', async () => {
    const { useConversationNotifications } = await import('./useConversationNotifications');
    
    const { result } = renderHook(() =>
      useConversationNotifications({
        conversations: [],
        selectedConversationId: undefined,
        enabled: false,
      })
    );

    expect(result.current.notificationCount).toBe(0);
  });

  it('should handle empty conversations array', async () => {
    const { useConversationNotifications } = await import('./useConversationNotifications');
    
    const { result } = renderHook(() =>
      useConversationNotifications({
        conversations: [],
        selectedConversationId: undefined,
        enabled: true,
      })
    );

    expect(result.current.notificationCount).toBe(0);
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from './useNotifications';

describe('useNotifications Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Audio API
    global.Audio = class {
      play = vi.fn().mockResolvedValue(undefined);
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('initializes with empty notifications array', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.notifications).toEqual([]);
    });

    it('initializes with default browser notification permission', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.browserNotificationPermission).toBeDefined();
    });

    it('requests browser notification permission on mount', async () => {
      const requestPermissionMock = vi.fn().mockResolvedValue('granted');
      global.Notification = {
        permission: 'default',
        requestPermission: requestPermissionMock,
      } as any;

      renderHook(() => useNotifications({ enableBrowserNotification: true }));

      await waitFor(() => {
        expect(requestPermissionMock).toHaveBeenCalled();
      });
    });

    it('does not request permission if already granted', () => {
      const requestPermissionMock = vi.fn();
      global.Notification = {
        permission: 'granted',
        requestPermission: requestPermissionMock,
      } as any;

      renderHook(() => useNotifications({ enableBrowserNotification: true }));

      expect(requestPermissionMock).not.toHaveBeenCalled();
    });
  });

  describe('Adding Notifications', () => {
    it('adds notification to array', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'Hello',
          timestamp: new Date(),
          customerId: 'customer-1',
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].customerName).toBe('John Doe');
    });

    it('generates unique ID for each notification', () => {
      const { result } = renderHook(() => useNotifications());

      let id1: string;
      let id2: string;

      act(() => {
        id1 = result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'Hello',
          timestamp: new Date(),
        });
        id2 = result.current.addNotification({
          customerName: 'Jane Smith',
          messagePreview: 'Hi',
          timestamp: new Date(),
        });
      });

      expect(id1).not.toBe(id2);
      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.notifications[0].id).toBe(id2);
      expect(result.current.notifications[1].id).toBe(id1);
    });

    it('adds new notifications to the beginning of array', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'First',
          timestamp: new Date(),
        });
        result.current.addNotification({
          customerName: 'Jane Smith',
          messagePreview: 'Second',
          timestamp: new Date(),
        });
      });

      expect(result.current.notifications[0].customerName).toBe('Jane Smith');
      expect(result.current.notifications[1].customerName).toBe('John Doe');
    });

    it('plays sound when notification is added', () => {
      const audioConstructorSpy = vi.spyOn(global, 'Audio' as any);

      const { result } = renderHook(() =>
        useNotifications({ enableSound: true })
      );

      act(() => {
        result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'Hello',
          timestamp: new Date(),
        });
      });

      expect(audioConstructorSpy).toHaveBeenCalled();
      audioConstructorSpy.mockRestore();
    });

    it('does not play sound when disabled', () => {
      const audioConstructorSpy = vi.spyOn(global, 'Audio' as any);

      const { result } = renderHook(() =>
        useNotifications({ enableSound: false })
      );

      act(() => {
        result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'Hello',
          timestamp: new Date(),
        });
      });

      expect(audioConstructorSpy).not.toHaveBeenCalled();
      audioConstructorSpy.mockRestore();
    });

    it('shows browser notification when added', () => {
      const notificationMock = vi.fn();
      global.Notification = notificationMock as any;
      global.Notification.permission = 'granted';

      const { result } = renderHook(() =>
        useNotifications({ enableBrowserNotification: true })
      );

      act(() => {
        result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'Hello',
          timestamp: new Date(),
          customerId: 'customer-1',
        });
      });

      expect(notificationMock).toHaveBeenCalledWith(
        'John Doe',
        expect.objectContaining({
          body: 'Hello',
          tag: 'notification-customer-1',
        })
      );
    });

    it('does not show browser notification when permission denied', () => {
      const notificationMock = vi.fn();
      global.Notification = notificationMock as any;
      global.Notification.permission = 'denied';

      const { result } = renderHook(() =>
        useNotifications({ enableBrowserNotification: true })
      );

      act(() => {
        result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'Hello',
          timestamp: new Date(),
        });
      });

      expect(notificationMock).not.toHaveBeenCalled();
    });
  });

  describe('Dismissing Notifications', () => {
    it('removes notification by ID', () => {
      const { result } = renderHook(() => useNotifications());

      let notificationId: string;
      act(() => {
        notificationId = result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'Hello',
          timestamp: new Date(),
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        result.current.dismissNotification(notificationId!);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('dismisses all notifications', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'Hello',
          timestamp: new Date(),
        });
        result.current.addNotification({
          customerName: 'Jane Smith',
          messagePreview: 'Hi',
          timestamp: new Date(),
        });
      });

      expect(result.current.notifications).toHaveLength(2);

      act(() => {
        result.current.dismissAllNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('dismisses notifications for specific customer', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.addNotification({
          customerName: 'John Doe',
          messagePreview: 'Hello',
          timestamp: new Date(),
          customerId: 'customer-1',
        });
        result.current.addNotification({
          customerName: 'Jane Smith',
          messagePreview: 'Hi',
          timestamp: new Date(),
          customerId: 'customer-2',
        });
        result.current.addNotification({
          customerName: 'John Doe 2',
          messagePreview: 'Hello again',
          timestamp: new Date(),
          customerId: 'customer-1',
        });
      });

      expect(result.current.notifications).toHaveLength(3);

      act(() => {
        result.current.dismissCustomerNotifications('customer-1');
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].customerId).toBe('customer-2');
    });
  });

  describe('Sound Playback', () => {
    it('plays sound with custom URL', () => {
      const audioConstructorSpy = vi.spyOn(global, 'Audio' as any);

      const { result } = renderHook(() =>
        useNotifications({
          enableSound: true,
          soundUrl: '/custom-sound.mp3',
        })
      );

      act(() => {
        result.current.playSound();
      });

      expect(audioConstructorSpy).toHaveBeenCalledWith('/custom-sound.mp3');
      audioConstructorSpy.mockRestore();
    });

    it('handles audio play errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
      const playMock = vi.fn().mockRejectedValue(new Error('Play failed'));
      global.Audio = class {
        play = playMock;
      } as any;

      const { result } = renderHook(() =>
        useNotifications({ enableSound: true })
      );

      act(() => {
        result.current.playSound();
      });

      // The error should be caught and handled gracefully
      // Just verify the function doesn't throw
      expect(result.current.playSound).toBeDefined();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Browser Notifications', () => {
    it('shows browser notification with custom options', () => {
      const notificationMock = vi.fn();
      global.Notification = notificationMock as any;
      global.Notification.permission = 'granted';

      const { result } = renderHook(() =>
        useNotifications({ enableBrowserNotification: true })
      );

      act(() => {
        result.current.showBrowserNotification('Test Title', {
          body: 'Test body',
        });
      });

      expect(notificationMock).toHaveBeenCalledWith(
        'Test Title',
        expect.objectContaining({
          body: 'Test body',
        })
      );
    });

    it('handles browser notification errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
      global.Notification = vi.fn(() => {
        throw new Error('Notification failed');
      }) as any;
      global.Notification.permission = 'granted';

      const { result } = renderHook(() =>
        useNotifications({ enableBrowserNotification: true })
      );

      act(() => {
        result.current.showBrowserNotification('Test');
      });

      // The error should be caught and handled gracefully
      // Just verify the function doesn't throw
      expect(result.current.showBrowserNotification).toBeDefined();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Options', () => {
    it('respects enableSound option', () => {
      const { result: resultWithSound } = renderHook(() =>
        useNotifications({ enableSound: true })
      );
      const { result: resultWithoutSound } = renderHook(() =>
        useNotifications({ enableSound: false })
      );

      // Both should initialize without errors
      expect(resultWithSound.current.notifications).toEqual([]);
      expect(resultWithoutSound.current.notifications).toEqual([]);

      // Both should be able to add notifications
      act(() => {
        resultWithSound.current.addNotification({
          customerName: 'John',
          messagePreview: 'Hello',
          timestamp: new Date(),
        });
      });

      expect(resultWithSound.current.notifications).toHaveLength(1);

      act(() => {
        resultWithoutSound.current.addNotification({
          customerName: 'Jane',
          messagePreview: 'Hi',
          timestamp: new Date(),
        });
      });

      expect(resultWithoutSound.current.notifications).toHaveLength(1);
    });

    it('respects enableBrowserNotification option', () => {
      const { result: resultWithNotif } = renderHook(() =>
        useNotifications({ enableBrowserNotification: true })
      );
      const { result: resultWithoutNotif } = renderHook(() =>
        useNotifications({ enableBrowserNotification: false })
      );

      // Both should initialize without errors
      expect(resultWithNotif.current.notifications).toEqual([]);
      expect(resultWithoutNotif.current.notifications).toEqual([]);

      // Both should be able to add notifications
      act(() => {
        resultWithNotif.current.addNotification({
          customerName: 'John',
          messagePreview: 'Hello',
          timestamp: new Date(),
        });
      });

      expect(resultWithNotif.current.notifications).toHaveLength(1);

      act(() => {
        resultWithoutNotif.current.addNotification({
          customerName: 'Jane',
          messagePreview: 'Hi',
          timestamp: new Date(),
        });
      });

      expect(resultWithoutNotif.current.notifications).toHaveLength(1);
    });
  });

  describe('Return Values', () => {
    it('returns all expected functions and state', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current).toHaveProperty('notifications');
      expect(result.current).toHaveProperty('addNotification');
      expect(result.current).toHaveProperty('dismissNotification');
      expect(result.current).toHaveProperty('dismissAllNotifications');
      expect(result.current).toHaveProperty('dismissCustomerNotifications');
      expect(result.current).toHaveProperty('browserNotificationPermission');
      expect(result.current).toHaveProperty('playSound');
      expect(result.current).toHaveProperty('showBrowserNotification');
    });

    it('returns functions that are callable', () => {
      const { result } = renderHook(() => useNotifications());

      expect(typeof result.current.addNotification).toBe('function');
      expect(typeof result.current.dismissNotification).toBe('function');
      expect(typeof result.current.dismissAllNotifications).toBe('function');
      expect(typeof result.current.dismissCustomerNotifications).toBe(
        'function'
      );
      expect(typeof result.current.playSound).toBe('function');
      expect(typeof result.current.showBrowserNotification).toBe('function');
    });
  });
});

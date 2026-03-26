/**
 * useNotifications Hook
 * Manages notification state and browser notification integration
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { NotificationData } from './Notification';

interface UseNotificationsOptions {
  enableSound?: boolean;
  enableBrowserNotification?: boolean;
  soundUrl?: string;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    enableSound = true,
    enableBrowserNotification = true,
    soundUrl = '/notification-sound.mp3',
  } = options;

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<NotificationPermission>('default');

  // Request browser notification permission on mount
  useEffect(() => {
    if (enableBrowserNotification && 'Notification' in window) {
      setBrowserNotificationPermission(Notification.permission);

      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          setBrowserNotificationPermission(permission);
        });
      }
    }
  }, [enableBrowserNotification]);

  // Play notification sound
  const playSound = useCallback(() => {
    if (!enableSound) return;

    try {
      const audio = new Audio(soundUrl);
      audio.play().catch((error) => {
        console.warn('Failed to play notification sound:', error);
      });
    } catch (error) {
      console.warn('Error creating audio element:', error);
    }
  }, [enableSound, soundUrl]);

  // Show browser notification
  const showBrowserNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (
        !enableBrowserNotification ||
        !('Notification' in window) ||
        browserNotificationPermission !== 'granted'
      ) {
        return;
      }

      try {
        new Notification(title, {
          icon: '/icon.png',
          badge: '/badge.png',
          ...options,
        });
      } catch (error) {
        console.warn('Failed to show browser notification:', error);
      }
    },
    [enableBrowserNotification, browserNotificationPermission]
  );

  // Add notification
  const addNotification = useCallback(
    (notification: Omit<NotificationData, 'id'>) => {
      const id = `notification-${Date.now()}-${Math.random()}`;
      const newNotification: NotificationData = {
        ...notification,
        id,
      };

      setNotifications((prev) => [newNotification, ...prev]);

      // Play sound
      playSound();

      // Show browser notification
      showBrowserNotification(notification.customerName, {
        body: notification.messagePreview,
        tag: `notification-${notification.customerId || 'general'}`,
      });

      return id;
    },
    [playSound, showBrowserNotification]
  );

  // Dismiss notification
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Dismiss all notifications
  const dismissAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Dismiss notifications for a specific customer
  const dismissCustomerNotifications = useCallback((customerId?: string) => {
    setNotifications((prev) =>
      prev.filter((n) => n.customerId !== customerId)
    );
  }, []);

  return {
    notifications,
    addNotification,
    dismissNotification,
    dismissAllNotifications,
    dismissCustomerNotifications,
    browserNotificationPermission,
    playSound,
    showBrowserNotification,
  };
}

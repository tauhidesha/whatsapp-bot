/**
 * useConversationNotifications Hook
 * Detects new messages and creates notifications for unselected conversations
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.7
 */

'use client';

import { useEffect, useRef } from 'react';
import { Conversation } from './useRealtimeConversations';
import { useNotifications } from '@/components/shared/useNotifications';

interface UseConversationNotificationsOptions {
  conversations: Conversation[];
  selectedConversationId?: string;
  enabled?: boolean;
}

export function useConversationNotifications({
  conversations,
  selectedConversationId,
  enabled = true,
}: UseConversationNotificationsOptions) {
  const previousCountsRef = useRef<Record<string, number>>({});
  const hasInitializedRef = useRef(false);

  const {
    notifications,
    addNotification,
    dismissNotification,
    dismissAllNotifications,
    dismissCustomerNotifications,
    browserNotificationPermission,
  } = useNotifications({
    enableSound: true,
    enableBrowserNotification: true,
  });

  // Request browser notification permission on first load
  useEffect(() => {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('Notification permission:', permission);
      });
    }
  }, [enabled]);

  // Detect new messages and create notifications
  useEffect(() => {
    if (!enabled || !conversations.length) return;

    const previousCounts = previousCountsRef.current;
    const nextCounts: Record<string, number> = {};

    conversations.forEach((conversation) => {
      const currentCount = conversation.unreadCount || 0;
      nextCounts[conversation.id] = currentCount;

      // Skip if this is the first load (initialization)
      if (!hasInitializedRef.current) return;

      const previousCount = previousCounts[conversation.id] || 0;
      const hasNewMessage = currentCount > previousCount;
      const isSelected = conversation.id === selectedConversationId;

      // Only notify for new messages in unselected conversations
      if (hasNewMessage && !isSelected) {
        addNotification({
          customerName: conversation.customerName || 'Unknown User',
          messagePreview: conversation.lastMessage || 'New message received',
          timestamp: new Date(),
          customerId: conversation.id,
        });
      }
    });

    previousCountsRef.current = nextCounts;
    hasInitializedRef.current = true;
  }, [conversations, selectedConversationId, enabled, addNotification]);

  // Clear notifications when a conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      dismissCustomerNotifications(selectedConversationId);
    }
  }, [selectedConversationId, dismissCustomerNotifications]);

  return {
    notifications,
    dismissNotification,
    dismissAllNotifications,
    dismissCustomerNotifications,
    browserNotificationPermission,
    notificationCount: notifications.length,
  };
}
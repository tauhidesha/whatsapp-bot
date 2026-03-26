/**
 * useRealtimeConversations Hook (Migrated to SQL/Prisma)
 * Manages conversation data from PostgreSQL via Prisma API
 * 
 * Requirement 1.1: Fetch and display all conversations from SQL
 * Requirement 1.4: Refresh conversation data every 15 seconds (Polling)
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  channel: 'whatsapp' | 'instagram' | 'messenger';
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  label?: string;
  aiState?: {
    enabled: boolean;
    pausedUntil?: number;
    reason?: string;
  };
  platformId?: string;
  profilePicUrl?: string;
}

interface UseRealtimeConversationsOptions {
  enabled?: boolean;
}

interface UseRealtimeConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  error: Error | null;
}

export function useRealtimeConversations(
  options: UseRealtimeConversationsOptions = {}
): UseRealtimeConversationsReturn {
  const { enabled = true } = options;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations?limit=100');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch conversations');
      }

      // Map API data (SQL format) to Hook data
      const mappedData: Conversation[] = json.data.map((item: any) => ({
        id: item.id,
        customerId: item.customerId,
        customerName: item.name,
        customerPhone: item.phone,
        channel: 'whatsapp', // Default for now
        lastMessage: item.lastMessage || 'No messagesyet',
        lastMessageTime: new Date(item.lastMessageAt).getTime(),
        unreadCount: 0, // Not implemented in SQL yet
        label: item.status,
        aiState: {
          enabled: !item.aiPaused,
          pausedUntil: item.aiPausedUntil ? new Date(item.aiPausedUntil).getTime() : undefined,
          reason: item.aiPauseReason,
        },
        platformId: item.phone,
        profilePicUrl: item.profilePicUrl,
      }));

      setConversations(mappedData);
      setError(null);
    } catch (err: any) {
      console.error('[Hook useRealtimeConversations] Error:', err);
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchConversations();

    // Set up polling (Requirement 1.4: 15s)
    intervalRef.current = setInterval(fetchConversations, 15000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled]);

  return {
    conversations,
    loading,
    error,
  };
}

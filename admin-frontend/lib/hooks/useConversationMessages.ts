/**
 * useConversationMessages Hook (Migrated to SQL/Prisma)
 * Manages message history for a specific conversation from PostgreSQL
 * 
 * Requirement 1.5: Display complete message history with sender labels
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export interface Message {
  id: string;
  conversationId: string;
  sender: 'customer' | 'ai' | 'admin';
  senderName?: string;
  content: string;
  timestamp: number;
  channel?: string;
  platformId?: string;
}

interface UseConversationMessagesOptions {
  conversationId?: string;
  enabled?: boolean;
}

interface UseConversationMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: Error | null;
}

export function useConversationMessages(
  options: UseConversationMessagesOptions = {}
): UseConversationMessagesReturn {
  const { conversationId, enabled = true } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = async () => {
    if (!conversationId) return;
    
    try {
      // Normalize number (remove @c.us etc)
      const phone = conversationId.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
      const res = await fetch(`/api/conversation-history/${phone}?limit=200`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch messages');
      }

      // Map API data (SQL format) to Hook data
      const mappedData: Message[] = json.data.map((item: any, idx: number) => ({
        id: `msg-${idx}-${item.timestamp}`,
        conversationId: conversationId,
        sender: item.sender === 'user' ? 'customer' : (item.sender === 'ai' ? 'ai' : 'admin'),
        senderName: item.sender === 'user' ? 'Pelanggan' : (item.sender === 'ai' ? 'Zoya Bot' : 'Admin'),
        content: item.text,
        timestamp: new Date(item.timestamp).getTime(),
      }));

      setMessages(mappedData);
      setError(null);
    } catch (err: any) {
      console.error('[Hook useConversationMessages] Error:', err);
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled || !conversationId) {
      setLoading(false);
      setMessages([]);
      return;
    }

    // Initial fetch
    fetchMessages();

    // Constant polling (10s)
    intervalRef.current = setInterval(fetchMessages, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [conversationId, enabled]);

  return {
    messages,
    loading,
    error,
  };
}

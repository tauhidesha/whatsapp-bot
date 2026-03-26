/**
 * Unit Tests for useConversationMessages Hook
 * Tests onSnapshot listener setup, cleanup, and error handling
 * 
 * Requirement 1.5: Test message history fetching
 * Requirement 16.1: Test error handling in hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConversationMessages, Message } from './useConversationMessages';
import * as firebaseFirestore from 'firebase/firestore';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  onSnapshot: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('@/lib/auth/firebase', () => ({
  db: {},
}));

describe('useConversationMessages', () => {
  let mockOnSnapshot: ReturnType<typeof vi.fn>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    mockOnSnapshot = vi.fn((query, onNext, onError) => {
      mockOnSnapshot.onNext = onNext;
      mockOnSnapshot.onError = onError;
      return mockUnsubscribe;
    });

    vi.mocked(firebaseFirestore.onSnapshot).mockImplementation(mockOnSnapshot);
    vi.mocked(firebaseFirestore.collection).mockReturnValue({} as any);
    vi.mocked(firebaseFirestore.query).mockReturnValue({} as any);
    vi.mocked(firebaseFirestore.where).mockReturnValue({} as any);
    vi.mocked(firebaseFirestore.orderBy).mockReturnValue({} as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onSnapshot listener setup', () => {
    it('should set up onSnapshot listener when enabled and conversationId provided', () => {
      // Requirement 1.5: Test listener setup
      renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      expect(firebaseFirestore.onSnapshot).toHaveBeenCalled();
    });

    it('should not set up listener when disabled', () => {
      renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: false })
      );

      expect(firebaseFirestore.onSnapshot).not.toHaveBeenCalled();
    });

    it('should not set up listener when conversationId is not provided', () => {
      renderHook(() => useConversationMessages({ enabled: true }));

      expect(firebaseFirestore.onSnapshot).not.toHaveBeenCalled();
    });

    it('should query messages collection with conversationId filter', () => {
      renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      expect(firebaseFirestore.collection).toHaveBeenCalledWith({}, 'messages');
      expect(firebaseFirestore.where).toHaveBeenCalledWith(
        'conversationId',
        '==',
        'conv-1'
      );
      expect(firebaseFirestore.orderBy).toHaveBeenCalledWith('timestamp', 'asc');
    });

    it('should return loading state initially', () => {
      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Data handling', () => {
    it('should update messages when snapshot data arrives', async () => {
      const mockMessages: Message[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          sender: 'customer',
          senderName: 'John Doe',
          content: 'Hello',
          timestamp: 1000,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          sender: 'ai',
          senderName: 'Zoya',
          content: 'Hi there!',
          timestamp: 2000,
        },
        {
          id: 'msg-3',
          conversationId: 'conv-1',
          sender: 'admin',
          senderName: 'Admin User',
          content: 'How can I help?',
          timestamp: 3000,
        },
      ];

      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      // Simulate snapshot data
      mockOnSnapshot.onNext({
        docs: mockMessages.map((msg) => ({
          id: msg.id,
          data: () => ({
            conversationId: msg.conversationId,
            sender: msg.sender,
            senderName: msg.senderName,
            content: msg.content,
            timestamp: msg.timestamp,
          }),
        })),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[0].sender).toBe('customer');
      expect(result.current.messages[1].sender).toBe('ai');
      expect(result.current.messages[2].sender).toBe('admin');
      expect(result.current.error).toBeNull();
    });

    it('should handle empty messages list', async () => {
      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      mockOnSnapshot.onNext({ docs: [] });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should clear messages when conversationId changes', async () => {
      const { result, rerender } = renderHook(
        ({ conversationId }) =>
          useConversationMessages({ conversationId, enabled: true }),
        { initialProps: { conversationId: 'conv-1' } }
      );

      mockOnSnapshot.onNext({
        docs: [
          {
            id: 'msg-1',
            data: () => ({
              conversationId: 'conv-1',
              sender: 'customer',
              content: 'Hello',
              timestamp: 1000,
            }),
          },
        ],
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
      });

      // Change conversationId - should set up new listener
      rerender({ conversationId: 'conv-2' });

      // New listener should receive empty data
      mockOnSnapshot.onNext({ docs: [] });

      await waitFor(() => {
        expect(result.current.messages).toEqual([]);
      });
    });

    it('should clear error when data arrives successfully', async () => {
      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      // Simulate error first
      mockOnSnapshot.onError(new Error('Initial error'));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Then simulate successful data
      mockOnSnapshot.onNext({ docs: [] });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle onSnapshot errors', async () => {
      // Requirement 16.1: Test error handling
      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      const testError = new Error('Firestore error');
      mockOnSnapshot.onError(testError);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to listen to messages');
    });

    it('should handle non-Error objects in onSnapshot error', async () => {
      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      mockOnSnapshot.onError('String error');

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to listen to messages');
    });

    it('should handle data processing errors', async () => {
      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      // Simulate snapshot with invalid data that causes processing error
      mockOnSnapshot.onNext({
        docs: [
          {
            id: 'msg-1',
            data: () => {
              throw new Error('Data processing error');
            },
          },
        ],
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to process messages');
    });

    it('should handle setup errors', () => {
      vi.mocked(firebaseFirestore.collection).mockImplementation(() => {
        throw new Error('Collection setup error');
      });

      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to set up message listener');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Cleanup on unmount', () => {
    it('should unsubscribe from listener on unmount', () => {
      // Requirement 5.1: Test cleanup on unmount
      const { unmount } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should not call unsubscribe if listener was not set up', () => {
      const { unmount } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: false })
      );

      unmount();

      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('should handle unsubscribe errors gracefully', () => {
      mockUnsubscribe.mockImplementation(() => {
        throw new Error('Unsubscribe error');
      });

      const { unmount } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      // Should not throw - errors are caught and logged
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Loading state transitions', () => {
    it('should transition from loading to loaded', async () => {
      // Requirement 16.1: Test loading state transitions
      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      expect(result.current.loading).toBe(true);

      mockOnSnapshot.onNext({ docs: [] });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should transition from loading to error', async () => {
      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      expect(result.current.loading).toBe(true);

      mockOnSnapshot.onError(new Error('Test error'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).not.toBeNull();
      });
    });

    it('should set loading to false when disabled', () => {
      const { result } = renderHook(() =>
        useConversationMessages({ enabled: false })
      );

      expect(result.current.loading).toBe(false);
    });

    it('should set loading to false when conversationId is not provided', () => {
      const { result } = renderHook(() =>
        useConversationMessages({ enabled: true })
      );

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Re-enabling listener', () => {
    it('should set up new listener when enabled changes from false to true', () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useConversationMessages({ conversationId: 'conv-1', enabled }),
        { initialProps: { enabled: false } }
      );

      expect(firebaseFirestore.onSnapshot).not.toHaveBeenCalled();

      rerender({ enabled: true });

      expect(firebaseFirestore.onSnapshot).toHaveBeenCalled();
    });

    it('should unsubscribe when enabled changes from true to false', () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useConversationMessages({ conversationId: 'conv-1', enabled }),
        { initialProps: { enabled: true } }
      );

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      rerender({ enabled: false });

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Message data structure', () => {
    it('should preserve all message fields', async () => {
      const mockMessage: Message = {
        id: 'msg-1',
        conversationId: 'conv-1',
        sender: 'admin',
        senderName: 'Admin User',
        content: 'This is a test message',
        timestamp: 1234567890,
        channel: 'whatsapp',
        platformId: 'wa-msg-123',
      };

      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      mockOnSnapshot.onNext({
        docs: [
          {
            id: mockMessage.id,
            data: () => ({
              conversationId: mockMessage.conversationId,
              sender: mockMessage.sender,
              senderName: mockMessage.senderName,
              content: mockMessage.content,
              timestamp: mockMessage.timestamp,
              channel: mockMessage.channel,
              platformId: mockMessage.platformId,
            }),
          },
        ],
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const message = result.current.messages[0];
      expect(message.id).toBe(mockMessage.id);
      expect(message.conversationId).toBe(mockMessage.conversationId);
      expect(message.sender).toBe(mockMessage.sender);
      expect(message.senderName).toBe(mockMessage.senderName);
      expect(message.content).toBe(mockMessage.content);
      expect(message.timestamp).toBe(mockMessage.timestamp);
      expect(message.channel).toBe(mockMessage.channel);
      expect(message.platformId).toBe(mockMessage.platformId);
    });

    it('should maintain message order by timestamp', async () => {
      const { result } = renderHook(() =>
        useConversationMessages({ conversationId: 'conv-1', enabled: true })
      );

      mockOnSnapshot.onNext({
        docs: [
          {
            id: 'msg-1',
            data: () => ({
              conversationId: 'conv-1',
              sender: 'customer',
              content: 'First',
              timestamp: 1000,
            }),
          },
          {
            id: 'msg-2',
            data: () => ({
              conversationId: 'conv-1',
              sender: 'ai',
              content: 'Second',
              timestamp: 2000,
            }),
          },
          {
            id: 'msg-3',
            data: () => ({
              conversationId: 'conv-1',
              sender: 'admin',
              content: 'Third',
              timestamp: 3000,
            }),
          },
        ],
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.messages[0].timestamp).toBe(1000);
      expect(result.current.messages[1].timestamp).toBe(2000);
      expect(result.current.messages[2].timestamp).toBe(3000);
    });
  });
});

/**
 * Unit Tests for useRealtimeConversations Hook
 * Tests onSnapshot listener setup, cleanup, and error handling
 * 
 * Requirement 1.1: Test real-time conversation fetching
 * Requirement 16.1: Test error handling in hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealtimeConversations, Conversation } from './useRealtimeConversations';
import * as firebaseFirestore from 'firebase/firestore';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('@/lib/auth/firebase', () => ({
  db: {},
}));

describe('useRealtimeConversations', () => {
  let mockOnSnapshot: ReturnType<typeof vi.fn>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    mockOnSnapshot = vi.fn((query, onNext, onError) => {
      // Store callbacks for testing
      mockOnSnapshot.onNext = onNext;
      mockOnSnapshot.onError = onError;
      return mockUnsubscribe;
    });

    vi.mocked(firebaseFirestore.onSnapshot).mockImplementation(mockOnSnapshot);
    vi.mocked(firebaseFirestore.collection).mockReturnValue({} as any);
    vi.mocked(firebaseFirestore.query).mockReturnValue({} as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onSnapshot listener setup', () => {
    it('should set up onSnapshot listener when enabled', () => {
      // Requirement 1.1: Test listener setup
      renderHook(() => useRealtimeConversations({ enabled: true }));

      expect(firebaseFirestore.onSnapshot).toHaveBeenCalled();
    });

    it('should not set up listener when disabled', () => {
      renderHook(() => useRealtimeConversations({ enabled: false }));

      expect(firebaseFirestore.onSnapshot).not.toHaveBeenCalled();
    });

    it('should query conversations collection', () => {
      renderHook(() => useRealtimeConversations({ enabled: true }));

      expect(firebaseFirestore.collection).toHaveBeenCalledWith({}, 'conversations');
    });

    it('should return loading state initially', () => {
      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      expect(result.current.loading).toBe(true);
      expect(result.current.conversations).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Data handling', () => {
    it('should update conversations when snapshot data arrives', async () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          customerId: 'cust-1',
          customerName: 'John Doe',
          customerPhone: '1234567890',
          channel: 'whatsapp',
          lastMessage: 'Hello',
          lastMessageTime: Date.now(),
          unreadCount: 1,
          label: 'hot_lead',
        },
        {
          id: 'conv-2',
          customerId: 'cust-2',
          customerName: 'Jane Smith',
          customerPhone: '0987654321',
          channel: 'instagram',
          lastMessage: 'Hi there',
          lastMessageTime: Date.now(),
          unreadCount: 0,
          label: 'cold_lead',
        },
      ];

      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      // Simulate snapshot data
      mockOnSnapshot.onNext({
        docs: mockConversations.map((conv) => ({
          id: conv.id,
          data: () => ({
            customerId: conv.customerId,
            customerName: conv.customerName,
            customerPhone: conv.customerPhone,
            channel: conv.channel,
            lastMessage: conv.lastMessage,
            lastMessageTime: conv.lastMessageTime,
            unreadCount: conv.unreadCount,
            label: conv.label,
          }),
        })),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.conversations).toHaveLength(2);
      expect(result.current.conversations[0].customerName).toBe('John Doe');
      expect(result.current.conversations[1].customerName).toBe('Jane Smith');
      expect(result.current.error).toBeNull();
    });

    it('should handle empty conversations list', async () => {
      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      mockOnSnapshot.onNext({ docs: [] });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.conversations).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should clear error when data arrives successfully', async () => {
      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

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
      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      const testError = new Error('Firestore error');
      mockOnSnapshot.onError(testError);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to listen to conversations');
    });

    it('should handle non-Error objects in onSnapshot error', async () => {
      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      mockOnSnapshot.onError('String error');

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to listen to conversations');
    });

    it('should handle data processing errors', async () => {
      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      // Simulate snapshot with invalid data that causes processing error
      mockOnSnapshot.onNext({
        docs: [
          {
            id: 'conv-1',
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
      expect(result.current.error?.message).toBe('Failed to process conversations');
    });

    it('should handle setup errors', () => {
      vi.mocked(firebaseFirestore.collection).mockImplementation(() => {
        throw new Error('Collection setup error');
      });

      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to set up conversation listener');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Cleanup on unmount', () => {
    it('should unsubscribe from listener on unmount', () => {
      // Requirement 5.1: Test cleanup on unmount
      const { unmount } = renderHook(() => useRealtimeConversations({ enabled: true }));

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should not call unsubscribe if listener was not set up', () => {
      const { unmount } = renderHook(() => useRealtimeConversations({ enabled: false }));

      unmount();

      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('should handle unsubscribe errors gracefully', () => {
      mockUnsubscribe.mockImplementation(() => {
        throw new Error('Unsubscribe error');
      });

      const { unmount } = renderHook(() => useRealtimeConversations({ enabled: true }));

      // Should not throw - errors are caught and logged
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Loading state transitions', () => {
    it('should transition from loading to loaded', async () => {
      // Requirement 16.1: Test loading state transitions
      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      expect(result.current.loading).toBe(true);

      mockOnSnapshot.onNext({ docs: [] });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should transition from loading to error', async () => {
      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      expect(result.current.loading).toBe(true);

      mockOnSnapshot.onError(new Error('Test error'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).not.toBeNull();
      });
    });

    it('should set loading to false when disabled', () => {
      const { result } = renderHook(() => useRealtimeConversations({ enabled: false }));

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Re-enabling listener', () => {
    it('should set up new listener when enabled changes from false to true', () => {
      const { rerender } = renderHook(
        ({ enabled }) => useRealtimeConversations({ enabled }),
        { initialProps: { enabled: false } }
      );

      expect(firebaseFirestore.onSnapshot).not.toHaveBeenCalled();

      rerender({ enabled: true });

      expect(firebaseFirestore.onSnapshot).toHaveBeenCalled();
    });

    it('should unsubscribe when enabled changes from true to false', () => {
      const { rerender } = renderHook(
        ({ enabled }) => useRealtimeConversations({ enabled }),
        { initialProps: { enabled: true } }
      );

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      rerender({ enabled: false });

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Conversation data structure', () => {
    it('should preserve all conversation fields', async () => {
      const mockConversation: Conversation = {
        id: 'conv-1',
        customerId: 'cust-1',
        customerName: 'John Doe',
        customerPhone: '1234567890',
        channel: 'whatsapp',
        lastMessage: 'Hello',
        lastMessageTime: 1234567890,
        unreadCount: 5,
        label: 'hot_lead',
        aiState: {
          enabled: false,
          pausedUntil: 1234567900,
          reason: 'Manual pause',
        },
        platformId: 'wa-123',
      };

      const { result } = renderHook(() => useRealtimeConversations({ enabled: true }));

      mockOnSnapshot.onNext({
        docs: [
          {
            id: mockConversation.id,
            data: () => ({
              customerId: mockConversation.customerId,
              customerName: mockConversation.customerName,
              customerPhone: mockConversation.customerPhone,
              channel: mockConversation.channel,
              lastMessage: mockConversation.lastMessage,
              lastMessageTime: mockConversation.lastMessageTime,
              unreadCount: mockConversation.unreadCount,
              label: mockConversation.label,
              aiState: mockConversation.aiState,
              platformId: mockConversation.platformId,
            }),
          },
        ],
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const conversation = result.current.conversations[0];
      expect(conversation.id).toBe(mockConversation.id);
      expect(conversation.customerId).toBe(mockConversation.customerId);
      expect(conversation.customerName).toBe(mockConversation.customerName);
      expect(conversation.channel).toBe(mockConversation.channel);
      expect(conversation.label).toBe(mockConversation.label);
      expect(conversation.aiState?.enabled).toBe(false);
      expect(conversation.platformId).toBe(mockConversation.platformId);
    });
  });
});

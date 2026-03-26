/**
 * Unit Tests for API Client
 * Tests error handling, authentication token injection, and retry logic
 * 
 * Requirement 16.1: Test network error scenarios
 * Requirement 16.2: Test authentication token injection and retry logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from './client';
import { ApiError } from './errors';

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let mockGetAuthToken: ReturnType<typeof vi.fn>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetAuthToken = vi.fn();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    apiClient = new ApiClient(
      'https://api.example.com',
      mockGetAuthToken,
      { maxRetries: 2, retryDelay: 100, retryableStatuses: [500, 502, 503] }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Token Injection', () => {
    it('should include Authorization header when token is provided', async () => {
      // Requirement 16.2: Test authentication token injection
      mockGetAuthToken.mockResolvedValue('test-token-123');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'success' }),
      });

      await apiClient.getConversations();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/conversations',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should not include Authorization header when token is null', async () => {
      mockGetAuthToken.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'success' }),
      });

      await apiClient.getConversations();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should always include Content-Type and ngrok-skip-browser-warning headers', async () => {
      mockGetAuthToken.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'success' }),
      });

      await apiClient.getConversations();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('token');
    });

    it('should throw ApiError with validation type for 4xx errors', async () => {
      // Requirement 16.1: Test error scenarios
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'Invalid request' }),
      });

      await expect(apiClient.getConversations()).rejects.toThrow(ApiError);
      
      try {
        await apiClient.getConversations();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).type).toBe('validation');
        expect((error as ApiError).statusCode).toBe(400);
        expect((error as ApiError).message).toBe('Invalid request');
      }
    });

    it('should throw ApiError with server type for 5xx errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'Internal server error' }),
      });

      try {
        await apiClient.getConversations();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).type).toBe('server');
        expect((error as ApiError).statusCode).toBe(500);
      }
    });

    it('should parse error message from JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: 'Not found' }),
      });

      try {
        await apiClient.getConversations();
      } catch (error) {
        expect((error as ApiError).message).toBe('Not found');
      }
    });

    it('should parse error message from message field in JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: 'Validation failed' }),
      });

      try {
        await apiClient.getConversations();
      } catch (error) {
        expect((error as ApiError).message).toBe('Validation failed');
      }
    });

    it('should use plain text as error message if JSON parsing fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Plain text error',
      });

      try {
        await apiClient.getConversations();
      } catch (error) {
        expect((error as ApiError).message).toBe('Plain text error');
      }
    });

    it('should throw ApiError with network type for fetch failures', async () => {
      // Requirement 16.1: Test network error scenarios
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      try {
        await apiClient.getConversations();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).type).toBe('network');
        expect((error as ApiError).message).toBe('Gagal terhubung ke server');
      }
    });
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('token');
    });

    it('should retry on 500 status code', async () => {
      // Requirement 16.2: Test retry logic
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      const result = await apiClient.getConversations();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry on 502 status code', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          text: async () => 'Bad gateway',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      const result = await apiClient.getConversations();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry on 503 status code', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Service unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      const result = await apiClient.getConversations();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      const result = await apiClient.getConversations();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: 'success' });
    });

    it('should not retry on 400 status code', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      await expect(apiClient.getConversations()).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 status code', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      });

      await expect(apiClient.getConversations()).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should stop retrying after max retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      await expect(apiClient.getConversations()).rejects.toThrow();

      // maxRetries is 2, so total attempts = 1 initial + 2 retries = 3
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      const startTime = Date.now();
      
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      await apiClient.getConversations();

      const elapsed = Date.now() - startTime;
      
      // First retry: 100ms, second retry: 200ms = 300ms total minimum
      // Allow some tolerance for execution time
      expect(elapsed).toBeGreaterThanOrEqual(250);
    });
  });

  describe('Request Methods', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('token');
    });

    it('should make GET request for getConversations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ conversations: [] }),
      });

      await apiClient.getConversations();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/conversations',
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
    });

    it('should make POST request for sendMessage', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const params = {
        number: '1234567890',
        message: 'Hello',
        channel: 'whatsapp',
      };

      await apiClient.sendMessage(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/send-message',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(params),
          headers: expect.any(Object),
        })
      );
    });

    it('should strip trailing slash from baseUrl', async () => {
      const clientWithTrailingSlash = new ApiClient(
        'https://api.example.com/',
        mockGetAuthToken
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'success' }),
      });

      await clientWithTrailingSlash.getConversations();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/conversations',
        expect.any(Object)
      );
    });
  });

  describe('Custom Retry Configuration', () => {
    it('should use custom maxRetries', async () => {
      const customClient = new ApiClient(
        'https://api.example.com',
        mockGetAuthToken,
        { maxRetries: 1, retryDelay: 50, retryableStatuses: [500] }
      );

      mockGetAuthToken.mockResolvedValue('token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      await expect(customClient.getConversations()).rejects.toThrow();

      // 1 initial + 1 retry = 2 total
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use custom retryableStatuses', async () => {
      const customClient = new ApiClient(
        'https://api.example.com',
        mockGetAuthToken,
        { maxRetries: 2, retryDelay: 50, retryableStatuses: [503] }
      );

      mockGetAuthToken.mockResolvedValue('token');
      
      // 500 should not be retried with custom config
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      await expect(customClient.getConversations()).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

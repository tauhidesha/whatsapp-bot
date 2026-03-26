/**
 * API Client for Backend Communication
 * Handles all HTTP requests to the Express backend
 * 
 * Requirement 15.6: Include authentication token in all Backend_API requests
 * Requirement 16.1: Display user-friendly error messages when Backend_API request fails
 * Requirement 16.2: Distinguish between network errors, server errors, and validation errors
 */

import { ApiError } from './errors';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: number[];
}

export class ApiClient {
  private baseUrl: string;
  private getAuthToken: () => Promise<string | null>;
  private retryConfig: RetryConfig;

  constructor(
    baseUrl: string, 
    getAuthToken: () => Promise<string | null>,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getAuthToken = getAuthToken;
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? 3,
      retryDelay: retryConfig?.retryDelay ?? 1000,
      retryableStatuses: retryConfig?.retryableStatuses ?? [408, 429, 500, 502, 503, 504],
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryable(error: unknown, statusCode?: number): boolean {
    // Network errors (fetch failures) are retryable
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }

    // Specific HTTP status codes are retryable
    if (statusCode && this.retryConfig.retryableStatuses.includes(statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Core request method with authentication, error handling, and retry logic
   * Requirement 15.6: Authentication token injection
   * Requirement 16.1: Error handling with user-friendly messages
   * Requirement 16.2: Distinguish error types
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    try {
      const token = await this.getAuthToken();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...((options.headers as Record<string, string>) || {}),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = text;
        
        try {
          const parsed = JSON.parse(text);
          errorMessage = parsed.error || parsed.message || text;
        } catch {
          // Use text as-is
        }

        // Determine error type based on status code
        let errorType: 'network' | 'server' | 'validation' = 'server';
        
        if (response.status >= 400 && response.status < 500) {
          errorType = 'validation';
        } else if (response.status >= 500) {
          errorType = 'server';
        }

        const apiError = new ApiError(errorMessage, response.status, errorType);

        // Retry logic for retryable errors
        if (this.isRetryable(apiError, response.status) && retryCount < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.retryDelay * Math.pow(2, retryCount); // Exponential backoff
          await this.sleep(delay);
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        throw apiError;
      }

      return response.json();
    } catch (error) {
      // Handle network errors (fetch failures)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new ApiError(
          'Gagal terhubung ke server',
          undefined,
          'network'
        );

        // Retry network errors
        if (retryCount < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.retryDelay * Math.pow(2, retryCount);
          await this.sleep(delay);
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        throw networkError;
      }

      // Re-throw ApiError instances
      if (error instanceof ApiError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        undefined,
        'server'
      );
    }
  }

  /**
   * Get all conversations
   * Requirement 1.1: Fetch all conversations from Firestore
   */
  async getConversations() {
    return this.request('/conversations');
  }

  /**
   * Get conversation history by ID
   * Requirement 1.5: Display complete message history with sender labels
   */
  async getConversationHistory(id: string) {
    return this.request(`/conversations/${id}/history`);
  }

  /**
   * Send a message to a customer
   * Requirement 2.3: POST message to /send-message
   */
  async sendMessage(params: {
    number: string;
    message: string;
    channel: string;
    platformId?: string;
  }) {
    return this.request('/send-message', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Update AI state (pause/resume) for a conversation
   * Requirement 3.3: POST to /conversation/{number}/ai-state
   */
  async updateAiState(number: string, params: {
    enabled: boolean;
    reason?: string;
  }) {
    return this.request(`/conversation/${number}/ai-state`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Update conversation label
   * Requirement 18.3: Update label in Firestore
   */
  async updateLabel(conversationId: string, params: {
    label: string;
    reason?: string;
  }) {
    return this.request(`/conversations/${conversationId}/label`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
  }

  /**
   * Test AI (Playground)
   * Send a message to the AI for testing purposes
   */
  async testAI(params: {
    message: string;
    mode?: string;
    media?: Array<{ type: string; mimetype: string; base64: string }>;
    history?: Array<{ role: string; content: string }>;
    model_override?: string;
  }) {
    return this.request('/test-ai', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Create a manual booking
   * POST to /bookings
   */
  async createBooking(params: {
    customerName: string;
    customerPhone: string;
    serviceName: string;
    bookingDate: string;
    bookingTime: string;
    vehicleInfo: string;
    notes?: string;
    subtotal?: number;
    homeService?: boolean;
  }) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

/**
 * Factory function to create an API client instance
 * Requirement 15.6: Authentication integration
 */
export const createApiClient = (
  baseUrl: string,
  getAuthToken: () => Promise<string | null>,
  retryConfig?: Partial<RetryConfig>
) => new ApiClient(baseUrl, getAuthToken, retryConfig);

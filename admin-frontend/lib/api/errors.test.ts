/**
 * Unit Tests for API Error Handling
 * Tests ApiError class and error message formatting
 * 
 * Requirement 16.1: Test user-friendly error messages
 * Requirement 16.2: Test error type distinction
 */

import { describe, it, expect } from 'vitest';
import { ApiError, handleApiError } from './errors';

describe('ApiError', () => {
  it('should create ApiError with message only', () => {
    const error = new ApiError('Test error');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ApiError');
    expect(error.statusCode).toBeUndefined();
    expect(error.type).toBeUndefined();
  });

  it('should create ApiError with status code', () => {
    const error = new ApiError('Not found', 404);
    
    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.type).toBeUndefined();
  });

  it('should create ApiError with type', () => {
    const error = new ApiError('Network error', undefined, 'network');
    
    expect(error.message).toBe('Network error');
    expect(error.statusCode).toBeUndefined();
    expect(error.type).toBe('network');
  });

  it('should create ApiError with all parameters', () => {
    const error = new ApiError('Server error', 500, 'server');
    
    expect(error.message).toBe('Server error');
    expect(error.statusCode).toBe(500);
    expect(error.type).toBe('server');
  });

  it('should maintain prototype chain', () => {
    const error = new ApiError('Test');
    
    expect(error instanceof ApiError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('handleApiError', () => {
  describe('ApiError handling', () => {
    it('should return network error message for network type', () => {
      // Requirement 16.1: Test user-friendly error messages
      const error = new ApiError('Connection failed', undefined, 'network');
      const message = handleApiError(error);
      
      expect(message).toBe('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    });

    it('should return server error message for server type', () => {
      const error = new ApiError('Internal error', 500, 'server');
      const message = handleApiError(error);
      
      expect(message).toBe('Terjadi kesalahan server: Internal error');
    });

    it('should return validation error message for validation type', () => {
      const error = new ApiError('Invalid input', 400, 'validation');
      const message = handleApiError(error);
      
      expect(message).toBe('Data tidak valid: Invalid input');
    });

    it('should return original message for ApiError without type', () => {
      const error = new ApiError('Generic error');
      const message = handleApiError(error);
      
      expect(message).toBe('Generic error');
    });
  });

  describe('Standard Error handling', () => {
    it('should return message from standard Error', () => {
      const error = new Error('Standard error message');
      const message = handleApiError(error);
      
      expect(message).toBe('Standard error message');
    });
  });

  describe('Unknown error handling', () => {
    it('should return default message for string error', () => {
      const message = handleApiError('string error');
      
      expect(message).toBe('Terjadi kesalahan yang tidak diketahui');
    });

    it('should return default message for number error', () => {
      const message = handleApiError(123);
      
      expect(message).toBe('Terjadi kesalahan yang tidak diketahui');
    });

    it('should return default message for null', () => {
      const message = handleApiError(null);
      
      expect(message).toBe('Terjadi kesalahan yang tidak diketahui');
    });

    it('should return default message for undefined', () => {
      const message = handleApiError(undefined);
      
      expect(message).toBe('Terjadi kesalahan yang tidak diketahui');
    });

    it('should return default message for object without message', () => {
      const message = handleApiError({ code: 'ERR_001' });
      
      expect(message).toBe('Terjadi kesalahan yang tidak diketahui');
    });
  });

  describe('Error type distinction', () => {
    it('should distinguish network errors', () => {
      // Requirement 16.2: Test error type distinction
      const networkError = new ApiError('Network failure', undefined, 'network');
      const serverError = new ApiError('Server failure', 500, 'server');
      const validationError = new ApiError('Validation failure', 400, 'validation');
      
      expect(handleApiError(networkError)).toContain('koneksi internet');
      expect(handleApiError(serverError)).toContain('kesalahan server');
      expect(handleApiError(validationError)).toContain('tidak valid');
    });
  });
});

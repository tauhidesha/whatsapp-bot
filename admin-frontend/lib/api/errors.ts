/**
 * API Error Classes
 * Requirement 16.1: Admin_Frontend SHALL display user-friendly error messages
 * Requirement 16.2: Admin_Frontend SHALL distinguish between network, server, and validation errors
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public type?: 'network' | 'server' | 'validation'
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Handle and format API errors for user display
 * Requirement 16.1: Display user-friendly error messages
 */
export function handleApiError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.type) {
      case 'network':
        return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      case 'server':
        return `Terjadi kesalahan server: ${error.message}`;
      case 'validation':
        return `Data tidak valid: ${error.message}`;
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Terjadi kesalahan yang tidak diketahui';
}

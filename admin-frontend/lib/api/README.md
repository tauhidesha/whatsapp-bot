# API Client Module

This module provides a robust HTTP client for communicating with the Express backend API.

## Features

### ✅ Authentication Integration (Requirement 15.6)
- Automatic injection of Firebase authentication tokens in all requests
- Bearer token authentication via `Authorization` header
- Graceful handling when no token is available

### ✅ Comprehensive Error Handling (Requirements 16.1, 16.2)
- **ApiError class** with typed error categories:
  - `network`: Connection failures, fetch errors
  - `server`: 5xx HTTP status codes
  - `validation`: 4xx HTTP status codes
- User-friendly error messages in Indonesian
- Automatic error parsing from JSON or plain text responses

### ✅ Automatic Retry Logic (Requirement 16.2)
- Configurable retry attempts (default: 3)
- Exponential backoff strategy
- Retries on:
  - Network failures (fetch errors)
  - Server errors (500, 502, 503, 504)
  - Timeout errors (408)
  - Rate limiting (429)
- No retries on client errors (4xx) to avoid wasted requests

## Usage

### Basic Setup

```typescript
import { createApiClient } from '@/lib/api';
import { auth } from '@/lib/auth/firebase';

// Create client instance
const apiClient = createApiClient(
  process.env.NEXT_PUBLIC_API_URL!,
  async () => {
    const user = auth.currentUser;
    return user ? await user.getIdToken() : null;
  }
);

// Make requests
const conversations = await apiClient.getConversations();
```

### Custom Retry Configuration

```typescript
import { createApiClient } from '@/lib/api';

const apiClient = createApiClient(
  'https://api.example.com',
  getAuthToken,
  {
    maxRetries: 5,           // Retry up to 5 times
    retryDelay: 2000,        // Start with 2 second delay
    retryableStatuses: [500, 503] // Only retry these status codes
  }
);
```

### Error Handling

```typescript
import { handleApiError, ApiError } from '@/lib/api';

try {
  await apiClient.sendMessage({ ... });
} catch (error) {
  // Get user-friendly error message
  const message = handleApiError(error);
  console.error(message);
  
  // Check error type for specific handling
  if (error instanceof ApiError) {
    if (error.type === 'network') {
      // Show offline indicator
    } else if (error.type === 'validation') {
      // Highlight form errors
    }
  }
}
```

### Example: Protected Component

```typescript
'use client';

import { useAuth } from '@/lib/auth/useAuth';
import { createApiClient, handleApiError } from '@/lib/api';
import { auth } from '@/lib/auth/firebase';
import { useEffect, useState } from 'react';

export default function ConversationsPage() {
  const { user, loading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const apiClient = createApiClient(
      process.env.NEXT_PUBLIC_API_BASE_URL!,
      async () => {
        const currentUser = auth.currentUser;
        return currentUser ? await currentUser.getIdToken() : null;
      }
    );

    apiClient.getConversations()
      .then(data => setConversations(data.conversations))
      .catch(err => setError(handleApiError(err)));
  }, [user]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please login</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Conversations</h1>
      {/* Render conversations */}
    </div>
  );
}
```

## API Methods

Currently implemented:
- `getConversations()` - Fetch all conversations
- `sendMessage(params)` - Send a message to a customer

Additional methods will be added in subsequent tasks.

## Testing

Comprehensive unit tests cover:
- ✅ Authentication token injection
- ✅ Error type classification (network, server, validation)
- ✅ Retry logic with exponential backoff
- ✅ Custom retry configuration
- ✅ Error message parsing
- ✅ Request method handling (GET, POST)

Run tests:
```bash
npm test -- lib/api
```

## Architecture

```
lib/api/
├── client.ts       # ApiClient class with request logic
├── errors.ts       # ApiError class and error handling utilities
├── index.ts        # Public exports
├── client.test.ts  # Client unit tests
├── errors.test.ts  # Error handling unit tests
└── README.md       # This file
```

## Implementation Details

### Retry Strategy
- Uses exponential backoff: delay × 2^retryCount
- Example with 1000ms base delay:
  - 1st retry: 1000ms
  - 2nd retry: 2000ms
  - 3rd retry: 4000ms

### Error Classification
- **Network errors**: `TypeError` from fetch failures
- **Server errors**: HTTP 5xx status codes
- **Validation errors**: HTTP 4xx status codes

### Headers
All requests include:
- `Content-Type: application/json`
- `ngrok-skip-browser-warning: true` (for development)
- `Authorization: Bearer <token>` (when authenticated)

## Authentication Flow

1. User logs in via Firebase Authentication
2. Firebase stores the session token securely
3. API client retrieves token via `user.getIdToken()`
4. Token is included in `Authorization` header
5. Backend validates token and processes request

## Token Refresh

Firebase SDK automatically refreshes tokens when they expire. The `getIdToken()` method always returns a valid token.

## Requirements Satisfied

- ✅ **15.6**: Authentication token included in all Backend_API requests
- ✅ **16.1**: User-friendly error messages when Backend_API request fails
- ✅ **16.2**: Distinguish between network errors, server errors, and validation errors
- ✅ **16.8**: Retry options for failed operations

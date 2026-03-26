# Firebase Authentication Setup

This directory contains Firebase Authentication and Firestore configuration for the admin frontend.

## Files

- `firebase.ts` - Firebase app initialization, auth, and Firestore client setup
- `useAuth.ts` - React hook for authentication state management
- `firebase.test.ts` - Unit tests for Firebase configuration
- `useAuth.test.tsx` - Unit tests for useAuth hook

## Requirements Implemented

- **Requirement 15.2**: Firebase Authentication integration
- **Requirement 15.3**: Email/password authentication support
- **Requirement 15.4**: Secure session token storage

## Usage

### Basic Authentication

```typescript
import { login, logout } from '@/lib/auth/firebase';

// Login
try {
  const userCredential = await login('user@example.com', 'password');
  console.log('Logged in:', userCredential.user);
} catch (error) {
  console.error('Login failed:', error);
}

// Logout
try {
  await logout();
  console.log('Logged out successfully');
} catch (error) {
  console.error('Logout failed:', error);
}
```

### Using the useAuth Hook

```typescript
import { useAuth } from '@/lib/auth/useAuth';

function MyComponent() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Accessing Firestore

```typescript
import { db } from '@/lib/auth/firebase';
import { collection, query, getDocs } from 'firebase/firestore';

async function fetchConversations() {
  const conversationsRef = collection(db, 'directMessages');
  const q = query(conversationsRef);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

### Real-time Firestore Listeners

```typescript
import { db } from '@/lib/auth/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';

function useRealtimeConversations() {
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'directMessages'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConversations(data);
    });

    return () => unsubscribe();
  }, []);

  return conversations;
}
```

## Environment Variables

Make sure to set the following environment variables in `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Testing

Run tests with:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Security Notes

- Firebase Authentication automatically handles secure token storage
- Tokens are stored in browser's secure storage (IndexedDB)
- Tokens are automatically refreshed by Firebase SDK
- All API requests should include the auth token via `getIdToken()`

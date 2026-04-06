# Fix: Supabase Realtime events firing but data not updating

## Root Cause

**File:** `admin-frontend/lib/hooks/useBookings.ts`

Two problems:

### Problem 1: `fetchingRef` blocks refetch
```ts
const fetchBookings = useCallback(async () => {
  if (fetchingRef.current) return;  // ← Blocks when ref is still true
  fetchingRef.current = true;
  // ... fetch
  fetchingRef.current = false;
}, []);
```

When Supabase fires an event, `revision++` triggers the useEffect, but `fetchingRef.current` may still be `true` from a recent fetch → **immediate return, no data fetched**.

### Problem 2: `useCallback` with empty deps
```ts
const fetchBookings = useCallback(async () => { ... }, []);
```

Empty dependency array means `fetchBookings` reference never changes. Combined with `fetchingRef`, this means **revision changes don't actually trigger new fetches**.

### Problem 3: Missing `cache: 'no-store'`
The `fetch()` call doesn't set `cache: 'no-store'`, so browser/Next.js may return cached responses.

## Fix

### File: `admin-frontend/lib/hooks/useBookings.ts`

**Change 1:** Add `cache: 'no-store'` to fetch call (line 58-59):
```diff
      const res = await fetch('/api/bookings?limit=100', {
-       headers: token ? { 'Authorization': `Bearer ${token}` } : {}
+       headers: token ? { 'Authorization': `Bearer ${token}` } : {},
+       cache: 'no-store',
      });
```

**Change 2:** Add `getIdToken` to useCallback deps (line 76):
```diff
- }, []);
+ }, [getIdToken]);
```

**Change 3:** Reset fetchingRef on revision change (line 79-81):
```diff
  // Fetch on mount + whenever Supabase emits a Booking event
  useEffect(() => {
+   fetchingRef.current = false; // Reset ref on revision change to allow refetch
    fetchBookings();
  }, [revision, fetchBookings]);
```

## Same Fix Needed For

The same pattern exists in other hooks. Check and fix:
- `useFinanceData.ts` - same `fetchingRef` + empty deps issue
- `useRealtimeConversations.ts` - same pattern
- `useConversationMessages.ts` - same pattern
- `components/finance/UnpaidBookingsList.tsx` - no realtime at all, needs subscription

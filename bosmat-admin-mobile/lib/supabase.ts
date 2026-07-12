import { createClient } from '@supabase/supabase-js';
import { ENV } from './env';
import { getIdToken } from './firebase';

/**
 * Supabase client for Realtime subscriptions only.
 * Data queries go through the Vercel API routes.
 */
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
  accessToken: async () => {
    const token = await getIdToken();
    return token || '';
  },
});

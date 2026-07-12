// Environment configuration for BosMat Admin Mobile
// Copy this file to env.ts and fill in your actual values

export const ENV = {
  // API Base URL (your Vercel deployment)
  API_BASE_URL: 'https://bosmatstudioadmin.vercel.app/api',

  // Firebase Config (same project as admin-frontend)
  FIREBASE_API_KEY: 'YOUR_FIREBASE_API_KEY',
  FIREBASE_AUTH_DOMAIN: 'YOUR_FIREBASE_AUTH_DOMAIN',
  FIREBASE_PROJECT_ID: 'YOUR_FIREBASE_PROJECT_ID',
  FIREBASE_STORAGE_BUCKET: 'YOUR_FIREBASE_STORAGE_BUCKET',
  FIREBASE_MESSAGING_SENDER_ID: 'YOUR_FIREBASE_MESSAGING_SENDER_ID',
  FIREBASE_APP_ID: 'YOUR_FIREBASE_APP_ID',

  // Supabase (for realtime only)
  SUPABASE_URL: 'YOUR_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
};

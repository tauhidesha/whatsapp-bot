/**
 * Firebase Authentication and Firestore Configuration
 * Requirement 15.2: Admin_Frontend SHALL integrate with Firebase Authentication
 * Requirement 15.3: Admin_Frontend SHALL support Google authentication
 * Requirement 15.4: Admin_Frontend SHALL store the session token securely
 */

'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let googleProvider: GoogleAuthProvider;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  
  // Configure Google Auth Provider
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
}

export { auth, db };

/**
 * Login with Google
 * Requirement 15.3: Support Google authentication
 */
export const loginWithGoogle = () => 
  signInWithPopup(auth, googleProvider);

/**
 * Logout current user
 * Requirement 15.4: Clear session token on logout
 */
export const logout = () => signOut(auth);

/**
 * Listen to authentication state changes
 * Requirement 15.4: Monitor session state
 */
export const onAuthChange = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);

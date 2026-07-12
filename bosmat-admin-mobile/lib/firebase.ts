import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  browserLocalPersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ENV } from './env';

const firebaseConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  
  if (Platform.OS === 'web') {
    // Di Web, gunakan default persistence (indexedDB/browserLocal)
    auth = getAuth(app);
  } else {
    // Di Native (iOS/Android), gunakan AsyncStorage
    const { getReactNativePersistence } = require('firebase/auth');
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} else {
  app = getApps()[0];
  auth = getAuth(app);
}

export { auth };

export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const onAuthChange = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);

export const getIdToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(false);
  } catch {
    return null;
  }
};

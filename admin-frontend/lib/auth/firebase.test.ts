/**
 * Unit Tests for Firebase Authentication Configuration
 * Tests Requirements 15.2, 15.3, 15.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase modules before importing
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    // Return unsubscribe function
    return () => {};
  }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ type: 'firestore' })),
}));

describe('Firebase Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export auth and db instances', async () => {
    // Mock window object for client-side check
    global.window = {} as any;
    
    const { auth, db } = await import('./firebase');
    
    expect(auth).toBeDefined();
    expect(db).toBeDefined();
  });

  it('should export login function', async () => {
    const { login } = await import('./firebase');
    expect(typeof login).toBe('function');
  });

  it('should export logout function', async () => {
    const { logout } = await import('./firebase');
    expect(typeof logout).toBe('function');
  });

  it('should export onAuthChange function', async () => {
    const { onAuthChange } = await import('./firebase');
    expect(typeof onAuthChange).toBe('function');
  });
});

describe('Firebase Auth Functions', () => {
  it('should call signInWithEmailAndPassword when login is called', async () => {
    global.window = {} as any;
    
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { login } = await import('./firebase');
    
    const email = 'test@example.com';
    const password = 'password123';
    
    login(email, password);
    
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      email,
      password
    );
  });

  it('should call signOut when logout is called', async () => {
    global.window = {} as any;
    
    const { signOut } = await import('firebase/auth');
    const { logout } = await import('./firebase');
    
    logout();
    
    expect(signOut).toHaveBeenCalledWith(expect.anything());
  });

  it('should call onAuthStateChanged when onAuthChange is called', async () => {
    global.window = {} as any;
    
    const { onAuthStateChanged } = await import('firebase/auth');
    const { onAuthChange } = await import('./firebase');
    
    const callback = vi.fn();
    onAuthChange(callback);
    
    expect(onAuthStateChanged).toHaveBeenCalledWith(
      expect.anything(),
      callback
    );
  });
});

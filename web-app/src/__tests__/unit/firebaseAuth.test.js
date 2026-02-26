/**
 * Unit tests for Firebase auth functions
 * Tests authentication operations: login, signup, password reset, etc.
 */

// Mock Firebase auth module BEFORE importing firebaseClient
jest.mock('firebase/auth', () => ({
  initializeApp: jest.fn(),
  getAuth: jest.fn(() => ({
    settings: {
      appVerificationDisabledForTesting: true,
    },
    currentUser: null,
  })),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  updatePassword: jest.fn(),
}));

// Mock Firebase firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  orderBy: jest.fn(),
}));

// Mock Firebase storage
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

// Import firebaseClient AFTER mocking Firebase modules
import * as firebaseModule from '@/api/firebaseClient';

describe('Firebase Client Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('firebase object', () => {
    test('should export firebase object with auth property', () => {
      expect(firebaseModule.firebase).toBeDefined();
      expect(firebaseModule.firebase.auth).toBeDefined();
    });

    test('should have entities property for database operations', () => {
      expect(firebaseModule.firebase.entities).toBeDefined();
    });

    test('should have functions property', () => {
      expect(firebaseModule.firebase.functions).toBeDefined();
    });

    test('should have all expected auth methods', () => {
      const expectedMethods = ['login', 'signUp', 'logout', 'resetPassword', 'onAuthStateChanged', 'me'];
      expectedMethods.forEach((method) => {
        expect(firebaseModule.firebase.auth[method]).toBeDefined();
        expect(typeof firebaseModule.firebase.auth[method]).toBe('function');
      });
    });
  });

  describe('auth.login', () => {
    test('should be available on auth object', () => {
      expect(typeof firebaseModule.firebase.auth.login).toBe('function');
    });
  });

  describe('auth.signUp', () => {
    test('should be available on auth object', () => {
      expect(typeof firebaseModule.firebase.auth.signUp).toBe('function');
    });
  });

  describe('auth.logout', () => {
    test('should be available on auth object', () => {
      expect(typeof firebaseModule.firebase.auth.logout).toBe('function');
    });
  });

  describe('auth.resetPassword', () => {
    test('should be available on auth object', () => {
      expect(typeof firebaseModule.firebase.auth.resetPassword).toBe('function');
    });
  });

  describe('auth.onAuthStateChanged', () => {
    test('should be available on auth object', () => {
      expect(typeof firebaseModule.firebase.auth.onAuthStateChanged).toBe('function');
    });
  });

  describe('auth.me', () => {
    test('should be available on auth object', () => {
      expect(typeof firebaseModule.firebase.auth.me).toBe('function');
    });
  });

  describe('auth.isAuthenticated', () => {
    test('should be available on auth object', () => {
      expect(typeof firebaseModule.firebase.auth.isAuthenticated).toBe('function');
    });
  });

  describe('module structure', () => {
    test('should export firebase object', () => {
      expect(firebaseModule.firebase).toBeDefined();
      expect(typeof firebaseModule.firebase).toBe('object');
    });

    test('should not throw on import', () => {
      expect(() => {
        const m = require('@/api/firebaseClient');
        expect(m.firebase).toBeDefined();
      }).not.toThrow();
    });

    test('should have all auth methods', () => {
      const authMethods = [
        'login',
        'signUp',
        'logout',
        'isAuthenticated',
        'me',
        'resetPassword',
        'onAuthStateChanged',
        'updateProfile',
      ];

      authMethods.forEach((method) => {
        expect(firebaseModule.firebase.auth[method]).toBeDefined();
        expect(typeof firebaseModule.firebase.auth[method]).toBe('function');
      });
    });

    test('should have entities for database operations', () => {
      const entityTypes = ['GarageSale', 'Payment', 'AppSettings', 'SavedListing'];

      entityTypes.forEach((entity) => {
        expect(firebaseModule.firebase.entities[entity]).toBeDefined();
      });
    });
  });
});

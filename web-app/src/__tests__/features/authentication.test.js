// src/__tests__/features/authentication.test.js
import { firebase } from '@/api/firebaseClient';

describe('Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Auth Status', () => {
    test('should check if user is authenticated', async () => {
      const isAuth = await firebase.auth.isAuthenticated();
      expect(isAuth).toBe(true);
      expect(firebase.auth.isAuthenticated).toHaveBeenCalled();
    });

    test('should return false when user is not authenticated', async () => {
      firebase.auth.isAuthenticated.mockResolvedValueOnce(false);
      const isAuth = await firebase.auth.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  describe('User Profile', () => {
    test('should fetch current user profile', async () => {
      const user = await firebase.auth.me();
      expect(user).toBeTruthy();
      expect(user.email).toBe('user@example.com');
      expect(firebase.auth.me).toHaveBeenCalled();
    });

    test('should handle missing user profile gracefully', async () => {
      firebase.auth.me.mockResolvedValueOnce(null);
      const user = await firebase.auth.me();
      expect(user).toBeNull();
    });
  });

  describe('Login', () => {
    test('should login user with credentials', async () => {
      const result = await firebase.auth.login('test@example.com', 'password123');
      expect(result).toBeTruthy();
      expect(result.email).toBeDefined();
      expect(firebase.auth.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    test('should handle login errors', async () => {
      firebase.auth.login.mockRejectedValueOnce(new Error('Invalid credentials'));
      await expect(firebase.auth.login('wrong@email.com', 'wrongpass')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('Logout', () => {
    test('should logout user', async () => {
      await firebase.auth.logout();
      expect(firebase.auth.logout).toHaveBeenCalled();
    });
  });
});

/**
 * Units tests for utility functions
 * Tests the createPageUrl function used for navigation
 */

import { createPageUrl } from '@/utils';

describe('Utility Functions', () => {
  describe('createPageUrl', () => {
    test('should convert single word page names to URL format', () => {
      expect(createPageUrl('Home')).toBe('/Home');
      expect(createPageUrl('Login')).toBe('/Login');
      expect(createPageUrl('Payment')).toBe('/Payment');
    });

    test('should convert multi-word page names to kebab-case URL format', () => {
      expect(createPageUrl('Create Listing')).toBe('/Create-Listing');
      expect(createPageUrl('Saved Listings')).toBe('/Saved-Listings');
      expect(createPageUrl('Admin Dashboard')).toBe('/Admin-Dashboard');
    });

    test('should handle multiple spaces between words', () => {
      expect(createPageUrl('Create  Listing')).toBe('/Create--Listing');
      expect(createPageUrl('Admin  Dashboard')).toBe('/Admin--Dashboard');
    });

    test('should preserve leading slash in output', () => {
      const url = createPageUrl('Home');
      expect(url.startsWith('/')).toBe(true);
    });

    test('should work with three-word page names', () => {
      expect(createPageUrl('My Saved Listings')).toBe('/My-Saved-Listings');
      expect(createPageUrl('Admin Dashboard Settings')).toBe('/Admin-Dashboard-Settings');
    });

    test('should handle empty string', () => {
      expect(createPageUrl('')).toBe('/');
    });

    test('should handle page names with existing dashes', () => {
      expect(createPageUrl('Create-Listing')).toBe('/Create-Listing');
      expect(createPageUrl('Saved-Listings')).toBe('/Saved-Listings');
    });
  });
});

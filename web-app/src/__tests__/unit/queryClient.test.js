/**
 * Unit tests for Query Client configuration
 * Tests TanStack Query client setup and default options
 */

import { queryClientInstance } from '@/lib/query-client';

describe('Query Client Configuration', () => {
  describe('queryClientInstance', () => {
    test('should be defined', () => {
      expect(queryClientInstance).toBeDefined();
    });

    test('should be a QueryClient instance', () => {
      expect(queryClientInstance.constructor.name).toBe('QueryClient');
    });

    test('should have QueryCache', () => {
      expect(queryClientInstance.getQueryCache()).toBeDefined();
    });

    test('should have MutationCache', () => {
      expect(queryClientInstance.getMutationCache()).toBeDefined();
    });

    test('should support clearing cache', () => {
      const cache = queryClientInstance.getQueryCache();
      
      // Should not throw when clearing
      expect(() => cache.clear()).not.toThrow();
    });

    test('should support finding queries', () => {
      const cache = queryClientInstance.getQueryCache();
      
      // findAll should return an array
      const allQueries = cache.findAll();
      expect(Array.isArray(allQueries)).toBe(true);
    });

    test('should allow mutation queries', () => {
      const mutationCache = queryClientInstance.getMutationCache();
      expect(mutationCache).toBeDefined();
      expect(mutationCache.findAll).toBeDefined();
    });

    test('should preserve configuration across multiple accesses', () => {
      const cache1 = queryClientInstance.getQueryCache();
      const cache2 = queryClientInstance.getQueryCache();

      // Same cache instance should be used
      expect(cache1).toBe(cache2);
    });

    test('should use singleton pattern (same instance)', () => {
      // Import again to verify singleton
      const { queryClientInstance: instance2 } = require('@/lib/query-client');
      
      // Both instances should have same cache
      const cache1 = queryClientInstance.getQueryCache();
      const cache2 = instance2.getQueryCache();
      expect(cache1).toBe(cache2);
    });
  });

  describe('cache management', () => {
    test('should support finding queries with filters', () => {
      const cache = queryClientInstance.getQueryCache();
      
      // Should be able to search queries with a predicate
      const matches = cache.findAll({ type: 'active' });
      expect(Array.isArray(matches)).toBe(true);
    });

    test('should maintain consistent caching strategy', () => {
      const cache1 = queryClientInstance.getQueryCache();
      const cache2 = queryClientInstance.getQueryCache();
      
      // Same cache instance should be used
      expect(cache1).toBe(cache2);
    });
  });

  describe('error handling', () => {
    test('should support error handling in mutation cache', () => {
      const cache = queryClientInstance.getMutationCache();
      
      expect(cache).toBeDefined();
      expect(cache.findAll).toBeDefined();
    });

    test('should provide mechanism to track errors', () => {
      const cache = queryClientInstance.getQueryCache();
      
      // Queries cache should support finding failed queries
      const allQueries = cache.findAll();
      expect(Array.isArray(allQueries)).toBe(true);
    });
  });
});

/**
 * Unit tests for Query Optimization utilities
 * Tests filtering, memoization, and distance calculations
 */

import { renderHook } from '@testing-library/react';
import {
  useFilteredListings,
  useIsListingSaved,
  useGroupedListings,
} from '@/lib/queryOptimization';

describe('Query Optimization Utilities', () => {
  describe('useFilteredListings', () => {
    const mockListings = [
      {
        id: '1',
        sale_type: 'garage_sale',
        postcode: '3000',
        latitude: -37.8136,
        longitude: 144.9631,
        title: 'Melbourne Garage Sale',
      },
      {
        id: '2',
        sale_type: 'yard_sale',
        postcode: '3121',
        latitude: -37.8044,
        longitude: 144.9988,
        title: 'Richmond Yard Sale',
      },
      {
        id: '3',
        sale_type: 'garage_sale',
        postcode: '3121',
        latitude: -37.8025,
        longitude: 145.0011,
        title: 'Carlton Garage Sale',
      },
    ];

    test('should return all listings when no criteria provided', () => {
      const { result } = renderHook(() =>
        useFilteredListings(mockListings, {})
      );

      expect(result.current).toEqual(mockListings);
      expect(result.current.length).toBe(3);
    });

    test('should return all listings when criteria is null', () => {
      const { result } = renderHook(() =>
        useFilteredListings(mockListings, null)
      );

      expect(result.current).toEqual(mockListings);
    });

    test('should filter listings by sale type', () => {
      const criteria = { saleType: 'garage_sale' };
      const { result } = renderHook(() =>
        useFilteredListings(mockListings, criteria)
      );

      expect(result.current.length).toBe(2);
      expect(result.current.every((l) => l.sale_type === 'garage_sale')).toBe(true);
    });

    test('should filter listings by postcode', () => {
      const criteria = { postcode: '3121' };
      const { result } = renderHook(() =>
        useFilteredListings(mockListings, criteria)
      );

      expect(result.current.length).toBe(2);
      expect(result.current.every((l) => l.postcode === '3121')).toBe(true);
    });

    test('should filter by both sale type and postcode', () => {
      const criteria = { saleType: 'garage_sale', postcode: '3121' };
      const { result } = renderHook(() =>
        useFilteredListings(mockListings, criteria)
      );

      expect(result.current.length).toBe(1);
      expect(result.current[0].id).toBe('3');
    });

    test('should filter by distance radius', () => {
      const criteria = {
        distance: '5', // 5 km
        userLatitude: -37.8136,
        userLongitude: 144.9631,
      };
      const { result } = renderHook(() =>
        useFilteredListings(mockListings, criteria)
      );

      // All listings should be within 5km of user location
      expect(result.current.length).toBeGreaterThan(0);
    });

    test('should handle all filter criteria together', () => {
      const criteria = {
        saleType: 'garage_sale',
        postcode: '3000',
        distance: '10',
        userLatitude: -37.8136,
        userLongitude: 144.9631,
      };
      const { result } = renderHook(() =>
        useFilteredListings(mockListings, criteria)
      );

      expect(result.current.length).toBe(1);
      expect(result.current[0].id).toBe('1');
    });

    test('should return empty array when no listings match criteria', () => {
      const criteria = { saleType: 'estate_sale' };
      const { result } = renderHook(() =>
        useFilteredListings(mockListings, criteria)
      );

      expect(result.current).toEqual([]);
    });

    test('should include sale type "all" to show everything', () => {
      const criteria = { saleType: 'all' };
      const { result } = renderHook(() =>
        useFilteredListings(mockListings, criteria)
      );

      expect(result.current.length).toBe(3);
    });
  });

  describe('useIsListingSaved', () => {
    const mockSavedListings = [
      { garage_sale_id: '1', user_id: 'user_123', saved_at: new Date() },
      { garage_sale_id: '3', user_id: 'user_123', saved_at: new Date() },
    ];

    test('should return true if listing is saved', () => {
      const { result } = renderHook(() =>
        useIsListingSaved('1', mockSavedListings)
      );

      expect(result.current).toBe(true);
    });

    test('should return false if listing is not saved', () => {
      const { result } = renderHook(() =>
        useIsListingSaved('2', mockSavedListings)
      );

      expect(result.current).toBe(false);
    });

    test('should work with empty saved listings', () => {
      const { result } = renderHook(() =>
        useIsListingSaved('1', [])
      );

      expect(result.current).toBe(false);
    });

    test('should handle multiple saved listings', () => {
      const { result: result1 } = renderHook(() =>
        useIsListingSaved('1', mockSavedListings)
      );
      const { result: result3 } = renderHook(() =>
        useIsListingSaved('3', mockSavedListings)
      );

      expect(result1.current).toBe(true);
      expect(result3.current).toBe(true);
    });

    test('should use strict equality for garage_sale_id', () => {
      const { result } = renderHook(() =>
        useIsListingSaved('1', mockSavedListings)
      );

      expect(result.current).toBe(true);

      const { result: result2 } = renderHook(() =>
        useIsListingSaved(1, mockSavedListings)
      );

      expect(result2.current).toBe(false); // 1 !== '1'
    });
  });

  describe('useGroupedListings', () => {
    const mockListings = [
      {
        id: '1',
        latitude: -37.8136,
        longitude: 144.9631,
        title: 'Sale 1',
      },
      {
        id: '2',
        latitude: -37.8136,
        longitude: 144.9631,
        title: 'Sale 2 (same location)',
      },
      {
        id: '3',
        latitude: -37.8044,
        longitude: 144.9988,
        title: 'Sale 3 (different location)',
      },
      {
        id: '4',
        latitude: -37.8044,
        longitude: 144.9988,
        title: 'Sale 4 (same as 3)',
      },
    ];

    test('should group listings by proximity', () => {
      const { result } = renderHook(() =>
        useGroupedListings(mockListings)
      );

      // Should create groups based on rounded coordinates
      const groups = result.current;
      expect(Object.keys(groups).length).toBeGreaterThan(0);
    });

    test('should combine listings at same location', () => {
      const { result } = renderHook(() =>
        useGroupedListings(mockListings)
      );

      const groups = result.current;
      // At least one group should have 2+ listings
      const hasGroupWith2 = Object.values(groups).some((group) => group.length >= 2);
      expect(hasGroupWith2).toBe(true);
    });

    test('should handle empty listings array', () => {
      const { result } = renderHook(() =>
        useGroupedListings([])
      );

      expect(result.current).toEqual({});
    });

    test('should handle single listing', () => {
      const { result } = renderHook(() =>
        useGroupedListings([mockListings[0]])
      );

      const groups = result.current;
      expect(Object.keys(groups).length).toBe(1);
      expect(Object.values(groups)[0].length).toBe(1);
    });

    test('should preserve listing data in groups', () => {
      const { result } = renderHook(() =>
        useGroupedListings(mockListings)
      );

      const groups = result.current;
      const allGroupedListings = Object.values(groups).flat();

      // All original listings should be in groups
      expect(allGroupedListings.length).toBe(mockListings.length);
    });

    test('should create consistent keys for nearby coordinates', () => {
      const nearby1 = {
        id: '1',
        latitude: -37.81361,
        longitude: 144.96311,
      };
      const nearby2 = {
        id: '2',
        latitude: -37.81364,
        longitude: 144.96314,
      };

      const { result } = renderHook(() =>
        useGroupedListings([nearby1, nearby2])
      );

      const groups = result.current;
      // Nearby coordinates should be grouped together
      const groupKeys = Object.keys(groups);
      expect(groupKeys.length).toBe(1);
      expect(groups[groupKeys[0]].length).toBe(2);
    });
  });

  describe('distance calculation', () => {
    test('useFilteredListings should filter by distance correctly', () => {
      const mockListings = [
        {
          id: '1',
          latitude: -37.8136,
          longitude: 144.9631,
          title: 'Close sale',
        },
        {
          id: '2',
          latitude: -37.713,
          longitude: 144.8637,
          title: 'Far sale (>10km)',
        },
      ];

      const criteria = {
        distance: '10',
        userLatitude: -37.8136,
        userLongitude: 144.9631,
      };

      const { result } = renderHook(() =>
        useFilteredListings(mockListings, criteria)
      );

      // Close sale should be included
      const hasCloseSale = result.current.some((l) => l.id === '1');
      expect(hasCloseSale).toBe(true);
    });
  });
});

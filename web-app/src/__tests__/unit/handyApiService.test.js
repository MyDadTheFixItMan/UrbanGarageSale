/**
 * Unit tests for HandyAPI Service
 * Tests suburb autocomplete and validation functions
 */

import { handyApiService } from '@/api/handyApiService';

// Mock fetch API
global.fetch = jest.fn();

describe('HandyAPI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe('autocomplete', () => {
    test('should return filtered results based on search text', async () => {
      const mockData = [
        { suburb: 'Melbourne', locality: 'Melbourne', postcode: '3000' },
        { suburb: 'Richmond', locality: 'Richmond', postcode: '3121' },
        { suburb: 'Carlton', locality: 'Carlton', postcode: '3053' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const results = await handyApiService.autocomplete('Melbourne');
      
      expect(results).toEqual([
        { suburb: 'Melbourne', locality: 'Melbourne', postcode: '3000' },
      ]);
    });

    test('should handle case-insensitive suburb search', async () => {
      const mockData = [
        { suburb: 'Melbourne', locality: 'Melbourne', postcode: '3000' },
        { suburb: 'Perth', locality: 'Perth', postcode: '6000' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const results = await handyApiService.autocomplete('MELBOURNE');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].suburb.toLowerCase()).toContain('melbourne');
    });

    test('should return empty array when no matches found', async () => {
      const mockData = [
        { suburb: 'Melbourne', postcode: '3000' },
        { suburb: 'Sydney', postcode: '2000' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const results = await handyApiService.autocomplete('NonexistentSuburb');
      
      expect(results).toEqual([]);
    });

    test('should return maximum 10 results', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        suburb: `Suburb${i}`,
        postcode: `${3000 + i}`,
      }));

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const results = await handyApiService.autocomplete('Suburb');
      
      expect(results.length).toBeLessThanOrEqual(10);
    });

    test('should throw error on API failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(handyApiService.autocomplete('Melbourne')).rejects.toThrow('API error: 500');
    });

    test('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(handyApiService.autocomplete('Melbourne')).rejects.toThrow('Network error');
    });
  });

  describe('validate', () => {
    test('should validate correct suburb and postcode combination', async () => {
      const mockData = [
        { suburb: 'Melbourne', postcode: '3000' },
        { suburb: 'Richmond', postcode: '3121' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await handyApiService.validate('Melbourne', '3000');
      
      expect(result.isValid).toBe(true);
    });

    test('should reject incorrect suburb and postcode combination', async () => {
      const mockData = [
        { suburb: 'Melbourne', postcode: '3000' },
        { suburb: 'Richmond', postcode: '3121' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await handyApiService.validate('Melbourne', '9999');
      
      expect(result.isValid).toBe(false);
    });

    test('should handle case-insensitive suburb validation', async () => {
      const mockData = [
        { suburb: 'Melbourne', postcode: '3000' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await handyApiService.validate('MELBOURNE', '3000');
      
      expect(result.isValid).toBe(true);
    });

    test('should throw error on API failure during validation', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(handyApiService.validate('Melbourne', '3000')).rejects.toThrow('API error: 500');
    });
  });
});

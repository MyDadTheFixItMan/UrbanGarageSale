/**
 * Unit tests for image optimization utilities
 * Tests image compression and file size calculations
 */

import { getFileSizeDisplay } from '@/lib/imageOptimization';

describe('Image Optimization Utilities', () => {
  describe('getFileSizeDisplay', () => {
    test('should display file size in Bytes for sizes < 1KB', () => {
      expect(getFileSizeDisplay(0)).toBe('0 Bytes');
      expect(getFileSizeDisplay(512)).toBe('512 Bytes');
      expect(getFileSizeDisplay(1023)).toBe('1023 Bytes');
    });

    test('should display file size in KB for sizes >= 1KB and < 1MB', () => {
      expect(getFileSizeDisplay(1024)).toBe('1 KB');
      expect(getFileSizeDisplay(2048)).toBe('2 KB');
      expect(getFileSizeDisplay(512000)).toBe('500 KB');
    });

    test('should display file size in MB for sizes >= 1MB', () => {
      expect(getFileSizeDisplay(1048576)).toBe('1 MB');
      expect(getFileSizeDisplay(5242880)).toBe('5 MB');
      expect(getFileSizeDisplay(10485760)).toBe('10 MB');
    });

    test('should round to 2 decimal places', () => {
      const result = getFileSizeDisplay(1536); // 1.5 KB
      expect(result).toMatch(/1\.5 KB/);
    });

    test('should handle edge cases correctly', () => {
      expect(getFileSizeDisplay(1)).toBe('1 Bytes');
      expect(getFileSizeDisplay(1024 * 1024)).toBe('1 MB');
    });
  });
});

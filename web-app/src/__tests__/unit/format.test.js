import { formatAud, formatDateAU, formatDateTimeAU } from '@/lib/format';

describe('Australian formatting helpers', () => {
  describe('formatAud', () => {
    it('formats dollars with two decimal places', () => {
      expect(formatAud(12.5)).toBe('$12.50');
      expect(formatAud(1234.5)).toBe('$1,234.50');
    });

    it('adds the A$ prefix when requested', () => {
      expect(formatAud(10, { withCode: true })).toBe('A$10.00');
    });

    it('treats missing or invalid amounts as zero', () => {
      expect(formatAud(undefined)).toBe('$0.00');
      expect(formatAud('abc')).toBe('$0.00');
    });
  });

  describe('formatDateAU', () => {
    it('uses day/month/year order', () => {
      expect(formatDateAU(new Date(2026, 9, 5))).toBe('05/10/2026');
    });

    it('treats YYYY-MM-DD strings as local calendar dates', () => {
      expect(formatDateAU('2026-01-31')).toBe('31/01/2026');
    });

    it('reads Firestore Timestamps', () => {
      const timestamp = { toDate: () => new Date(2026, 11, 25) };
      expect(formatDateAU(timestamp)).toBe('25/12/2026');
    });

    it('returns the fallback for empty or invalid values', () => {
      expect(formatDateAU(null, 'No date')).toBe('No date');
      expect(formatDateAU('not a date', 'No date')).toBe('No date');
    });
  });

  describe('formatDateTimeAU', () => {
    it('puts the date before the time', () => {
      const text = formatDateTimeAU(new Date(2026, 9, 5, 14, 30));
      expect(text.startsWith('05/10/2026')).toBe(true);
      expect(text).toMatch(/2:30/);
    });
  });
});

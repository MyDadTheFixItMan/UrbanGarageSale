import { formatAud, formatDateAU, formatDateTimeAU, formatTimeAU, saleDayLabel, saleWhenLabel, formatDistanceKm } from '@/lib/format';

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

describe('listing card labels', () => {
  const NOW = new Date(2026, 10, 10, 9, 30); // Tue 10 Nov 2026, 9:30 am

  describe('formatTimeAU', () => {
    it('shows whole hours without minutes', () => {
      expect(formatTimeAU('08:00')).toBe('8am');
      expect(formatTimeAU('15:00')).toBe('3pm');
    });

    it('keeps minutes and handles midday and midnight', () => {
      expect(formatTimeAU('13:30')).toBe('1:30pm');
      expect(formatTimeAU('12:00')).toBe('12pm');
      expect(formatTimeAU('00:15')).toBe('12:15am');
    });

    it('returns text it does not recognise unchanged', () => {
      expect(formatTimeAU('early')).toBe('early');
      expect(formatTimeAU(undefined)).toBe('');
    });
  });

  describe('saleDayLabel', () => {
    it('says Today for a sale today or one already running', () => {
      expect(saleDayLabel('2026-11-10', '2026-11-10', NOW)).toBe('Today');
      expect(saleDayLabel('2026-11-08', '2026-11-11', NOW)).toBe('Today');
    });

    it('says Tomorrow, then the weekday within the next week', () => {
      expect(saleDayLabel('2026-11-11', '2026-11-11', NOW)).toBe('Tomorrow');
      expect(saleDayLabel('2026-11-14', '2026-11-15', NOW)).toBe('Sat');
    });

    it('adds the date for sales a week or more away', () => {
      expect(saleDayLabel('2026-11-17', '2026-11-17', NOW)).toBe('Tue 17 Nov');
    });

    it('returns nothing without a start date', () => {
      expect(saleDayLabel(undefined, undefined, NOW)).toBe('');
    });
  });

  it('saleWhenLabel joins the day and hours', () => {
    const sale = { start_date: '2026-11-14', end_date: '2026-11-14', start_time: '07:00', end_time: '13:00' };
    expect(saleWhenLabel(sale, NOW)).toBe('Sat · 7am–1pm');
    expect(saleWhenLabel({ start_date: '2026-11-14' }, NOW)).toBe('Sat');
  });

  it('formatDistanceKm rounds to suit the distance', () => {
    expect(formatDistanceKm(0.43)).toBe('0.4 km away');
    expect(formatDistanceKm(9.97)).toBe('10 km away');
    expect(formatDistanceKm(23.6)).toBe('24 km away');
    expect(formatDistanceKm(undefined)).toBe('');
  });
});

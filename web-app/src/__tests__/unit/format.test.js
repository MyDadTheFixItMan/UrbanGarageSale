import { formatAud, formatDateAU, formatDateTimeAU, formatTimeAU, saleDatesLabel, saleSoonLabel, saleWhenLabel, formatDistanceKm } from '@/lib/format';

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

  describe('saleDatesLabel', () => {
    it('shows the weekday, date and month for a one-day sale', () => {
      expect(saleDatesLabel('2026-11-14', '2026-11-14')).toBe('Sat 14th Nov');
      expect(saleDatesLabel('2026-11-21')).toBe('Sat 21st Nov');
    });

    it('shows a range for a multi-day sale', () => {
      expect(saleDatesLabel('2027-01-01', '2027-01-03')).toBe('Fri 1st to Sun 3rd Jan');
      expect(saleDatesLabel('2026-11-14', '2026-11-15')).toBe('Sat 14th to Sun 15th Nov');
    });

    it('names both months when the sale runs across two', () => {
      expect(saleDatesLabel('2026-10-31', '2026-11-01')).toBe('Sat 31st Oct to Sun 1st Nov');
    });

    it('uses th for the 11th to 13th', () => {
      expect(saleDatesLabel('2026-12-11', '2026-12-13')).toBe('Fri 11th to Sun 13th Dec');
      expect(saleDatesLabel('2026-11-22')).toBe('Sun 22nd Nov');
    });

    it('returns nothing without a start date', () => {
      expect(saleDatesLabel(undefined, undefined)).toBe('');
    });
  });

  describe('saleSoonLabel', () => {
    it('says Today for a sale today or one already running', () => {
      expect(saleSoonLabel('2026-11-10', '2026-11-10', NOW)).toBe('Today');
      expect(saleSoonLabel('2026-11-08', '2026-11-11', NOW)).toBe('Today');
    });

    it('says Tomorrow for a sale starting tomorrow', () => {
      expect(saleSoonLabel('2026-11-11', '2026-11-12', NOW)).toBe('Tomorrow');
    });

    it('returns nothing for later sales or without a start date', () => {
      expect(saleSoonLabel('2026-11-14', '2026-11-15', NOW)).toBe('');
      expect(saleSoonLabel(undefined, undefined, NOW)).toBe('');
    });
  });

  it('saleWhenLabel joins Today/Tomorrow, the dates and hours', () => {
    const sale = { start_date: '2026-11-14', end_date: '2026-11-14', start_time: '07:00', end_time: '13:00' };
    expect(saleWhenLabel(sale, NOW)).toBe('Sat 14th Nov · 7am–1pm');
    expect(saleWhenLabel({ ...sale, start_date: '2026-11-10', end_date: '2026-11-10' }, NOW)).toBe('Today · Tue 10th Nov · 7am–1pm');
    expect(saleWhenLabel({ start_date: '2026-11-11', end_date: '2026-11-13' }, NOW)).toBe('Tomorrow · Wed 11th to Fri 13th Nov');
  });

  it('formatDistanceKm rounds to suit the distance', () => {
    expect(formatDistanceKm(0.43)).toBe('0.4 km away');
    expect(formatDistanceKm(9.97)).toBe('10 km away');
    expect(formatDistanceKm(23.6)).toBe('24 km away');
    expect(formatDistanceKm(undefined)).toBe('');
  });
});

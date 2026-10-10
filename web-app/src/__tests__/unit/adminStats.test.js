import {
  toDate,
  splitUsersByProfile,
  isFullPostcode,
  matchPayments,
  paymentsSince,
  filterPayments,
  paymentListingValues,
  isFreePeriodActive,
  nextPromoSequence,
  reorderPromotions,
  filterMessages
} from '@/pages/admin/adminStats';

const NOW = new Date(2026, 9, 9, 15, 30); // 9 Oct 2026, 3:30 pm local time

describe('admin dashboard helpers', () => {
  describe('toDate', () => {
    it('accepts Dates, Firestore Timestamps and ISO strings', () => {
      expect(toDate(NOW)).toBe(NOW);
      expect(toDate({ toDate: () => NOW })).toBe(NOW);
      expect(toDate('2026-10-09').getDate()).toBe(9);
    });

    it('returns null for anything else', () => {
      expect(toDate(undefined)).toBeNull();
      expect(toDate(42)).toBeNull();
    });
  });

  describe('splitUsersByProfile', () => {
    it('separates users without a name (unfinished sign-ups)', () => {
      const users = [{ id: 'a', full_name: 'Sam' }, { id: 'b', full_name: '  ' }, { id: 'c' }];
      const { complete, incomplete } = splitUsersByProfile(users);
      expect(complete.map((u) => u.id)).toEqual(['a']);
      expect(incomplete.map((u) => u.id)).toEqual(['b', 'c']);
    });
  });

  describe('isFullPostcode', () => {
    it('accepts only four-digit postcodes', () => {
      expect(isFullPostcode('3000')).toBe(true);
      expect(isFullPostcode('300')).toBe(false);
      expect(isFullPostcode('30000')).toBe(false);
      expect(isFullPostcode('30a0')).toBe(false);
      expect(isFullPostcode('')).toBe(false);
    });
  });

  describe('matchPayments', () => {
    it('pairs payments with their listing and payer by id, falling back to email', () => {
      const payments = [
        { id: 'p1', garage_sale_id: 's1', user_id: 'u1' },
        { id: 'p2', garage_sale_id: 'missing', user_id: 'deleted-user', user_email: 'b@example.com' }
      ];
      const listings = [{ id: 's1', suburb: 'Fitzroy' }];
      const users = [{ id: 'u1', email: 'a@example.com' }, { id: 'u2', email: 'b@example.com' }];

      const matched = matchPayments(payments, listings, users);

      expect(matched.p1).toEqual({ sale: listings[0], user: users[0] });
      expect(matched.p2).toEqual({ sale: undefined, user: users[1] });
    });
  });

  describe('paymentsSince', () => {
    it('starts "today" at midnight', () => {
      expect(paymentsSince('today', NOW)).toEqual(new Date(2026, 9, 9));
    });

    it('goes back 7 or 30 days for week and month', () => {
      expect(paymentsSince('week', NOW)).toEqual(new Date(2026, 9, 2, 15, 30));
      expect(paymentsSince('month', NOW)).toEqual(new Date(2026, 8, 9, 15, 30));
    });

    it('returns null for all dates', () => {
      expect(paymentsSince('all', NOW)).toBeNull();
    });
  });

  describe('filterPayments and paymentListingValues', () => {
    const payments = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
    const matched = {
      p1: { sale: { suburb: 'Fitzroy', state: 'VIC' } },
      p2: { sale: { suburb: 'Newtown', state: 'NSW' } },
      p3: { sale: undefined }
    };

    it('keeps everything with no filters', () => {
      expect(filterPayments(payments, matched)).toHaveLength(3);
    });

    it("filters on the payment's listing suburb and state", () => {
      expect(filterPayments(payments, matched, { suburb: 'Fitzroy' }).map((p) => p.id)).toEqual(['p1']);
      expect(filterPayments(payments, matched, { state: 'NSW' }).map((p) => p.id)).toEqual(['p2']);
      expect(filterPayments(payments, matched, { suburb: 'Fitzroy', state: 'NSW' })).toEqual([]);
    });

    it('lists the distinct values present for the filter options', () => {
      expect(paymentListingValues(payments, matched, 'state')).toEqual(['VIC', 'NSW']);
    });
  });

  describe('isFreePeriodActive', () => {
    const period = { active: true, start: '2026-10-01', end: '2026-10-09' };

    it('is active from the start date to the end date inclusive', () => {
      expect(isFreePeriodActive(period, NOW)).toBe(true);
      expect(isFreePeriodActive(period, new Date(2026, 9, 1))).toBe(true);
    });

    it('is inactive outside the dates, when switched off, or when a date is missing', () => {
      expect(isFreePeriodActive(period, new Date(2026, 9, 10))).toBe(false);
      expect(isFreePeriodActive(period, new Date(2026, 8, 30))).toBe(false);
      expect(isFreePeriodActive({ ...period, active: false }, NOW)).toBe(false);
      expect(isFreePeriodActive({ ...period, end: '' }, NOW)).toBe(false);
    });
  });

  describe('promotions', () => {
    it('numbers a new promotion after the highest sequence', () => {
      expect(nextPromoSequence([])).toBe(1);
      expect(nextPromoSequence([{ sequence: 2 }, { sequence: 5 }, {}])).toBe(6);
    });

    it('swaps neighbours and returns only the changed sequences', () => {
      const promos = [{ id: 'a', sequence: 1 }, { id: 'b', sequence: 2 }, { id: 'c', sequence: 3 }];
      expect(reorderPromotions(promos, 1, -1)).toEqual([{ id: 'b', sequence: 1 }, { id: 'a', sequence: 2 }]);
    });

    it('renumbers gaps and ignores moves past either end', () => {
      const promos = [{ id: 'a', sequence: 4 }, { id: 'b', sequence: 9 }];
      expect(reorderPromotions(promos, 0, -1)).toEqual([]);
      expect(reorderPromotions(promos, 1, 1)).toEqual([]);
      expect(reorderPromotions(promos, 0, 1)).toEqual([{ id: 'b', sequence: 1 }, { id: 'a', sequence: 2 }]);
    });
  });

  describe('filterMessages', () => {
    const messages = [{ id: 'm1', response: 'Thanks' }, { id: 'm2' }];

    it('splits messages by whether they have been answered', () => {
      expect(filterMessages(messages, 'all')).toHaveLength(2);
      expect(filterMessages(messages, 'waiting').map((m) => m.id)).toEqual(['m2']);
      expect(filterMessages(messages, 'closed').map((m) => m.id)).toEqual(['m1']);
    });
  });
});

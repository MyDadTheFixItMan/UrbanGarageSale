import { canBeSaved, canBeShared, hasFinished } from '@/lib/listings';

const today = '2026-11-07';

describe('canBeSaved', () => {
  it('allows an active listing that is running or still to come', () => {
    expect(canBeSaved({ status: 'active', end_date: '2026-11-08' }, today)).toBe(true);
    expect(canBeSaved({ status: 'active', end_date: today }, today)).toBe(true);
  });

  it.each(['draft', 'pending_payment', 'pending_approval', 'completed', 'rejected'])('refuses a listing that is %s', (status) => {
    expect(canBeSaved({ status, end_date: '2026-11-08' }, today)).toBe(false);
  });

  it('refuses an active listing that has finished but is not yet marked completed', () => {
    expect(canBeSaved({ status: 'active', end_date: '2026-11-06' }, today)).toBe(false);
  });
});

describe('canBeShared', () => {
  it('allows only approved sales that have not finished', () => {
    expect(canBeShared({ status: 'active', end_date: today }, today)).toBe(true);
    expect(canBeShared({ status: 'pending_approval', end_date: '2026-11-08' }, today)).toBe(false);
    expect(canBeShared({ status: 'active', end_date: '2026-11-06' }, today)).toBe(false);
  });
});

describe('hasFinished', () => {
  it('is true for completed sales and for live ones whose last day has passed', () => {
    expect(hasFinished({ status: 'completed', end_date: '2026-11-08' }, today)).toBe(true);
    expect(hasFinished({ status: 'active', end_date: '2026-11-06' }, today)).toBe(true);
  });

  it('is false for sales still on or to come', () => {
    expect(hasFinished({ status: 'active', end_date: today }, today)).toBe(false);
    expect(hasFinished({ status: 'pending_approval', end_date: '2026-11-08' }, today)).toBe(false);
    expect(hasFinished({ status: 'draft' }, today)).toBe(false);
  });
});

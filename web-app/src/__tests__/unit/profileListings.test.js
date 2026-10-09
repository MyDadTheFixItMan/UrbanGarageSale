import { groupProfileListings, listingActions, changePasswordProblem, isUnpaidDraft } from '@/pages/profile/profileListings';

const TODAY = new Date(2026, 9, 9, 12, 0); // 9 Oct 2026

const listing = (overrides) => ({ id: overrides.id, status: 'active', payment_status: 'paid', end_date: '2026-10-12', ...overrides });

describe('groupProfileListings', () => {
  const listings = [
    listing({ id: 'live' }),
    listing({ id: 'awaiting-approval', status: 'pending_approval', payment_status: 'free' }),
    listing({ id: 'ends-today', end_date: '2026-10-09' }),
    listing({ id: 'unpaid-active', payment_status: 'pending' }),
    listing({ id: 'no-end-date', end_date: undefined }),
    listing({ id: 'draft', status: 'draft', payment_status: undefined }),
    listing({ id: 'pending-payment', status: 'pending_payment', payment_status: undefined }),
    listing({ id: 'expired', end_date: '2026-10-08' }),
    listing({ id: 'completed', status: 'completed' }),
    listing({ id: 'rejected', status: 'rejected' }),
  ];
  const groups = groupProfileListings(listings, TODAY);
  const ids = (list) => list.map((l) => l.id);

  it('shows paid or free listings that have not ended as active', () => {
    expect(ids(groups.active)).toEqual(['live', 'awaiting-approval', 'ends-today']);
  });

  it('shows unpaid drafts as drafts', () => {
    expect(ids(groups.drafts)).toEqual(['draft', 'pending-payment']);
  });

  it('shows completed listings and live listings whose end date passed as past', () => {
    expect(ids(groups.past)).toEqual(['expired', 'completed']);
  });

  it('does not show rejected listings in any tab', () => {
    const all = [...groups.active, ...groups.drafts, ...groups.past];
    expect(all.find((l) => l.id === 'rejected')).toBeUndefined();
  });
});

describe('listingActions', () => {
  it('lets sellers pay for and edit unpaid drafts, but not view or print them', () => {
    expect(listingActions({ status: 'draft' })).toEqual({ view: false, edit: true, pay: true, print: false });
    expect(isUnpaidDraft({ status: 'pending_payment' })).toBe(true);
  });

  it('lets sellers view, edit and print approved listings', () => {
    expect(listingActions({ status: 'active' })).toEqual({ view: true, edit: true, pay: false, print: true });
  });

  it('lets sellers view and print listings awaiting approval, but not edit them', () => {
    expect(listingActions({ status: 'pending_approval' })).toEqual({ view: true, edit: false, pay: false, print: true });
  });

  it('only lets sellers view finished or rejected listings', () => {
    expect(listingActions({ status: 'completed' })).toEqual({ view: true, edit: false, pay: false, print: false });
    expect(listingActions({ status: 'rejected' })).toEqual({ view: true, edit: false, pay: false, print: false });
  });
});

describe('changePasswordProblem', () => {
  const valid = { currentPassword: 'old-password-1', newPassword: 'new-password-123', confirmPassword: 'new-password-123' };

  it('accepts a valid change', () => {
    expect(changePasswordProblem(valid)).toBeNull();
  });

  it('reports the first problem in field order', () => {
    expect(changePasswordProblem({ ...valid, currentPassword: '' })).toBe('Please enter your current password');
    expect(changePasswordProblem({ ...valid, newPassword: '' })).toBe('Please enter a new password');
    expect(changePasswordProblem({ ...valid, newPassword: 'short1', confirmPassword: 'short1' })).toMatch(/at least 12 characters/);
    expect(changePasswordProblem({ ...valid, newPassword: 'onlyletterslong', confirmPassword: 'onlyletterslong' })).toMatch(/letters and numbers/);
    expect(changePasswordProblem({ ...valid, confirmPassword: 'different-123456' })).toBe('New passwords do not match');
  });
});

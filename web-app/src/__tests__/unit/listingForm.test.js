import {
  EMPTY_FORM, formFromListing, isPaidOrApproved, listingFormProblem,
  isInFreePeriod, buildSaleData, liveEditData, photoProblem,
} from '@/pages/createListing/listingForm';

const form = (overrides = {}) => ({
  ...EMPTY_FORM,
  title: 'Moving sale',
  address: '1 Main St, Carlton VIC 3053',
  suburb: 'Carlton',
  postcode: '3053',
  state: 'VIC',
  start_date: '2026-11-07',
  end_date: '2026-11-08',
  ...overrides,
});

describe('listingFormProblem', () => {
  it('accepts a complete form', () => {
    expect(listingFormProblem(form())).toBeNull();
  });

  it('reports missing required fields in order', () => {
    expect(listingFormProblem(form({ title: '  ' }))).toBe('Please enter a title');
    expect(listingFormProblem(form({ address: '' }))).toBe('Please enter an address');
    expect(listingFormProblem(form({ start_date: '' }))).toBe('Please select a start date');
    expect(listingFormProblem(form({ end_date: '' }))).toBe('Please select an end date');
  });

  it('allows up to three consecutive days', () => {
    expect(listingFormProblem(form({ end_date: '2026-11-09' }))).toBeNull();
    expect(listingFormProblem(form({ end_date: '2026-11-10' }))).toMatch(/maximum of 3 consecutive days/);
  });

  it('refuses an end date before the start date', () => {
    expect(listingFormProblem(form({ end_date: '2026-11-06' }))).toBe('End date must be after start date');
  });
});

describe('isInFreePeriod', () => {
  const settings = { is_active: true, free_listing_start: '2026-11-01', free_listing_end: '2026-11-30' };

  it('is true when the sale starts inside an active free period, including its first and last days', () => {
    expect(isInFreePeriod(settings, '2026-11-01')).toBe(true);
    expect(isInFreePeriod(settings, '2026-11-15')).toBe(true);
    expect(isInFreePeriod(settings, '2026-11-30')).toBe(true);
  });

  it('is false outside the period, when switched off, or without a start date', () => {
    expect(isInFreePeriod(settings, '2026-12-01')).toBe(false);
    expect(isInFreePeriod({ ...settings, is_active: false }, '2026-11-15')).toBe(false);
    expect(isInFreePeriod(settings, '')).toBe(false);
    expect(isInFreePeriod(undefined, '2026-11-15')).toBe(false);
  });

  it('is false when the period has no dates', () => {
    expect(isInFreePeriod({ is_active: true }, '2026-11-15')).toBe(false);
  });

  it('accepts Firestore Timestamp dates', () => {
    const timestamp = (iso) => ({ toDate: () => new Date(iso) });
    const stored = { is_active: true, free_listing_start: timestamp('2026-11-01T00:00:00Z'), free_listing_end: timestamp('2026-11-30T00:00:00Z') };
    expect(isInFreePeriod(stored, '2026-11-15')).toBe(true);
  });
});

describe('buildSaleData', () => {
  const coords = { lat: -37.8, lng: 144.97 };
  const NOW = Date.UTC(2026, 10, 1);

  it('saves a draft as unpaid with a two-day expiry', () => {
    const data = buildSaleData(form(), { asDraft: true, isFree: false, coords, now: NOW });
    expect(data).toMatchObject({ status: 'draft', payment_status: 'pending', latitude: -37.8, longitude: 144.97 });
    expect(data.draft_expires_at).toBe('2026-11-03T00:00:00.000Z');
  });

  it('waits for payment when publishing a paid listing, with the same two-day expiry', () => {
    const data = buildSaleData(form(), { asDraft: false, isFree: false, coords, now: NOW });
    expect(data).toMatchObject({ status: 'pending_payment', payment_status: 'pending', draft_expires_at: '2026-11-03T00:00:00.000Z' });
  });

  it('sends a free-period listing for admin approval, with no expiry', () => {
    const data = buildSaleData(form(), { asDraft: false, isFree: true, coords });
    expect(data).toMatchObject({ status: 'pending_approval', payment_status: 'completed', draft_expires_at: null });
  });
});

describe('liveEditData', () => {
  it('holds only what can change on a paid or approved listing', () => {
    const photos = ['1.jpg'];
    expect(liveEditData(form({ description: 'Tools', sale_type: 'yard_sale', photos, thumbnails: ['1-thumb.jpg'] }))).toEqual({
      title: 'Moving sale',
      description: 'Tools',
      sale_type: 'yard_sale',
      photos,
      thumbnails: ['1-thumb.jpg'],
    });
  });
});

describe('isPaidOrApproved', () => {
  it('matches the listings whose dates and location firestore.rules lock', () => {
    expect(isPaidOrApproved({ status: 'active' })).toBe(true);
    expect(isPaidOrApproved({ status: 'pending_approval' })).toBe(true);
    expect(isPaidOrApproved({ status: 'draft', payment_status: 'paid' })).toBe(true);
    expect(isPaidOrApproved({ status: 'draft', payment_status: 'pending' })).toBe(false);
    expect(isPaidOrApproved({ status: 'pending_payment' })).toBe(false);
  });
});

describe('formFromListing', () => {
  it('fills the form from a listing and defaults missing fields', () => {
    const result = formFromListing({ id: 'x', title: 'Sale', status: 'active', latitude: -37.8 });
    expect(result).toEqual({ ...EMPTY_FORM, title: 'Sale', latitude: -37.8 });
  });
});

describe('photoProblem', () => {
  const file = (overrides) => ({ name: 'a.jpg', type: 'image/jpeg', size: 1000, ...overrides });

  it('accepts a small JPEG, PNG or WEBP', () => {
    expect(photoProblem(file())).toBeNull();
    expect(photoProblem(file({ type: 'image/webp' }))).toBeNull();
  });

  it('accepts a typical large phone photo', () => {
    expect(photoProblem(file({ size: 8 * 1024 * 1024 }))).toBeNull();
  });

  it('refuses other types and files over 20MB', () => {
    expect(photoProblem(file({ type: 'image/gif' }))).toMatch(/Only JPEG, PNG, or WEBP/);
    expect(photoProblem(file({ size: 21 * 1024 * 1024 }))).toMatch(/exceeds 20MB/);
  });
});

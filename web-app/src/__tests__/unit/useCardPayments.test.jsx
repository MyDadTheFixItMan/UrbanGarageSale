import { renderHook } from '@testing-library/react';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { auth: { me: jest.fn() }, currentUser: null },
}));
jest.mock('@/api/firebase/entities', () => ({ AU_STATES: ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] }));
jest.mock('@/lib/api-base', () => ({ API_BASE_URL: '', apiFetch: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), loading: jest.fn() } }));

import { stripeAddress, useCardPayments } from '@/pages/profile/useCardPayments';

const originalOpener = window.opener;
let closeSpy;

function openProfile(search, { opener = null, name = '' } = {}) {
  window.history.pushState({}, '', `/profile${search}`);
  window.opener = opener;
  window.name = name;
  renderHook(() => useCardPayments(null, jest.fn()));
}

beforeEach(() => {
  closeSpy = jest.spyOn(window, 'close').mockImplementation(() => {});
});

afterEach(() => {
  closeSpy.mockRestore();
  window.opener = originalOpener;
  window.name = '';
  window.history.pushState({}, '', '/');
});

describe('stripeAddress', () => {
  it('sends the suburb as the city', () => {
    expect(stripeAddress({ address: '25 Moorabool Street', suburb: 'Geelong' }).city).toBe('Geelong');
  });

  it('uses the address on the profile', () => {
    expect(stripeAddress({ address: '26 Seawind Place', state: 'VIC', postcode: '3226' }))
      .toEqual({ address: '26 Seawind Place', state: 'VIC', postcode: '3226' });
  });

  it('leaves out a state or postcode the API would reject, so Stripe asks for them', () => {
    expect(stripeAddress({ address: '1 Main St', state: 'Victoria', postcode: '32' }))
      .toEqual({ address: '1 Main St', state: undefined, postcode: undefined });
    expect(stripeAddress({})).toEqual({ address: undefined, state: undefined, postcode: undefined });
  });
});

describe('useCardPayments popup closing', () => {
  it('closes the Stripe popup when onboarding succeeds', () => {
    openProfile('?tab=payments&success=true', { opener: {} });
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('recognises the popup by name when Stripe cleared the opener', () => {
    openProfile('?tab=payments&success=true', { name: 'stripeOnboarding' });
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('leaves a normal tab open', () => {
    openProfile('?tab=payments&success=true');
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('stays open when Stripe sends the seller back to try again', () => {
    openProfile('?tab=payments', { opener: {} });
    expect(closeSpy).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { firebase, getSuburbCoordinates } from '@/api/firebaseClient';
import Home from '@/pages/Home';
import { toLocalIsoDate } from '@/api/firebase/listingSearch';

jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    auth: { isAuthenticated: jest.fn(), me: jest.fn() },
    entities: { GarageSale: { filter: jest.fn() }, SavedListing: { mine: jest.fn() } },
    firestore: { collection: () => ({ getDocs: async () => [] }) },
  },
  getSuburbCoordinates: jest.fn(),
}));
jest.mock('@/components/map/SaleMap', () => function MockSaleMap() {
  return null;
});
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), loading: jest.fn(), dismiss: jest.fn() },
}));

function renderHome(url) {
  window.history.pushState({}, '', url);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.scrollTo = jest.fn();
  firebase.auth.isAuthenticated.mockResolvedValue(false);
  firebase.entities.GarageSale.filter.mockResolvedValue([]);
  firebase.entities.SavedListing.mine.mockResolvedValue([]);
});

afterEach(() => {
  delete navigator.geolocation;
});

// The page of a sale that has finished links to sales nearby with ?near=.
describe('Home ?near= links', () => {
  it('searches near the suburb or postcode in the link', async () => {
    getSuburbCoordinates.mockResolvedValue({ lat: -38.16, lng: 144.52 });
    renderHome('/?near=3226');
    await waitFor(() => expect(firebase.entities.GarageSale.filter).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', userLatitude: -38.16, userLongitude: 144.52 }),
    ));
    expect(getSuburbCoordinates).toHaveBeenCalledWith('3226');
    expect(screen.getByLabelText('Suburb or Postcode')).toHaveValue('3226');
    // Taken out of the address, so a reload goes back to the visitor's own last search.
    expect(window.location.search).toBe('');
  });

  it('searches near the visitor with ?near=me', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: jest.fn((success) => success({ coords: { latitude: -37.77, longitude: 144.96 } })) },
      configurable: true,
    });
    renderHome('/?near=me');
    await waitFor(() => expect(firebase.entities.GarageSale.filter).toHaveBeenCalledWith(
      expect.objectContaining({ userLatitude: -37.77, userLongitude: 144.96 }),
    ));
    expect(getSuburbCoordinates).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Suburb or Postcode')).toHaveValue('');
  });
});

describe('Home search date', () => {
  const today = toLocalIsoDate(new Date());
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return toLocalIsoDate(d); })();

  it("starts on today's date on a first visit", () => {
    renderHome('/');
    expect(screen.getByLabelText('Date')).toHaveValue(today);
  });

  it("moves a saved date that has passed, or a saved 'Any date', to today", async () => {
    for (const saleDate of ['2020-01-01', '']) {
      localStorage.setItem('homeSearchFilters', JSON.stringify({ postcode: '', distance: '25', saleType: 'all', saleDate }));
      const { unmount } = renderHome('/');
      await waitFor(() => expect(screen.getByLabelText('Date')).toHaveValue(today));
      unmount();
    }
  });

  it('keeps a saved date later than today', async () => {
    localStorage.setItem('homeSearchFilters', JSON.stringify({ postcode: '', distance: '25', saleType: 'all', saleDate: tomorrow }));
    renderHome('/');
    await waitFor(() => expect(screen.getByLabelText('Date')).toHaveValue(tomorrow));
  });

  it("searches on today's date from a ?near= link", async () => {
    getSuburbCoordinates.mockResolvedValue({ lat: -38.16, lng: 144.52 });
    renderHome('/?near=3226');
    await waitFor(() => expect(firebase.entities.GarageSale.filter).toHaveBeenCalledWith(
      expect.objectContaining({ saleDate: today }),
    ));
  });
});

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    auth: { isAuthenticated: jest.fn(), me: jest.fn() },
    firestore: { collection: () => ({ getDocs: async () => [] }) },
    entities: {
      SavedListing: { mine: jest.fn(), delete: jest.fn() },
      GarageSale: { getByIds: jest.fn() },
    },
  },
}));
jest.mock('@/lib/geocode', () => ({ geocode: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), info: jest.fn() } }));

import { firebase } from '@/api/firebaseClient';
import { geocode } from '@/lib/geocode';
import { toast } from 'sonner';
import SavedListings from '@/pages/SavedListings';

const listing = (id, address, latitude, longitude) => ({
  id, address, latitude, longitude, title: id, start_date: '2026-11-07', start_time: '08:00', end_time: '14:00',
});

// In the order they were saved, which isn't the order they should be driven in.
const sales = [
  listing('bell-park', '55 Deakin St', -38.108, 144.335),
  listing('ocean-grove', '39 Shell Rd', -38.262, 144.53),
  listing('geelong', '87 Ryrie St', -38.148, 144.361),
  listing('hamlyn-heights', '19 Shannon Ave', -38.12, 144.33),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SavedListings />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function clickRouteToAll() {
  const button = await screen.findByRole('button', { name: /route to all/i });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  return new URL(window.open.mock.calls[0][0]).searchParams;
}

beforeEach(() => {
  jest.clearAllMocks();
  window.open = jest.fn();
  firebase.auth.isAuthenticated.mockResolvedValue(true);
  firebase.entities.SavedListing.mine.mockResolvedValue(sales.map((s) => ({ id: `saved-${s.id}`, garage_sale_id: s.id })));
  firebase.entities.GarageSale.getByIds.mockResolvedValue(sales);
});

describe('Route to All', () => {
  it('starts from the full home address and drives to the closest stop, then the next closest', async () => {
    firebase.auth.me.mockResolvedValue({ email: 'a@b.test', address: '10 Example St', state: 'VIC', postcode: '3226' });
    geocode.mockResolvedValue({ lat: -38.27, lng: 144.52, components: [] });

    renderPage();
    const query = await clickRouteToAll();

    expect(geocode).toHaveBeenCalledWith('10 Example St, VIC 3226, Australia', { country: 'AU' });
    expect(query.get('origin')).toBe('10 Example St, VIC 3226, Australia');
    expect(query.get('waypoints')).toBe('-38.262,144.53|-38.148,144.361|-38.12,144.33');
    expect(query.get('destination')).toBe('-38.108,144.335');
  });

  it('still routes from the home address when the map lookup fails', async () => {
    firebase.auth.me.mockResolvedValue({ email: 'a@b.test', address: '10 Example St', state: 'VIC', postcode: '3226' });
    geocode.mockRejectedValue(new Error('Google Maps did not respond'));

    renderPage();
    const query = await clickRouteToAll();

    expect(query.get('origin')).toBe('10 Example St, VIC 3226, Australia');
    expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/saved order/i));
  });

  it('tells the user when the account has no home address to start from', async () => {
    firebase.auth.me.mockResolvedValue({ email: 'a@b.test', address: '' });

    renderPage();
    const query = await clickRouteToAll();

    expect(query.has('origin')).toBe(false);
    expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/add your home address/i));
  });
});

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import ListingDetails from '@/pages/ListingDetails';

jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    auth: { isAuthenticated: jest.fn(), me: jest.fn() },
    entities: { GarageSale: { filter: jest.fn() }, SavedListing: { mine: jest.fn() } },
    firestore: { collection: () => ({ getDocs: async () => [] }) },
  },
}));
jest.mock('@/components/map/SaleMap', () => function MockSaleMap() {
  return null;
});
jest.mock('@/utils/printGarageSaleSign', () => ({ paperSizes: {}, printAfterDialogCloses: jest.fn() }));

const fullListing = {
  id: 'sale-1',
  title: 'Big sale',
  status: 'active',
  address: '12 Example St',
  suburb: 'Ocean Grove',
  postcode: '3226',
  state: 'VIC',
  start_date: '2099-01-01',
  end_date: '2099-01-01',
  user_id: 'seller',
};
// What a visitor who isn't signed in gets: the public copy, without the address or seller.
const { address, user_id, ...publicCopy } = fullListing;

async function renderListing({ listing = fullListing, userId = 'someone-else', url = '/ListingDetails?id=sale-1' } = {}) {
  firebase.auth.isAuthenticated.mockResolvedValue(Boolean(userId));
  firebase.auth.me.mockResolvedValue({ id: userId, email: 'a@b.test' });
  firebase.entities.GarageSale.filter.mockResolvedValue([listing]);
  firebase.entities.SavedListing.mine.mockResolvedValue([]);
  window.history.pushState({}, '', url);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ListingDetails />
      </MemoryRouter>
    </QueryClientProvider>
  );
  await screen.findByRole('heading', { name: 'Big sale' });
  await waitFor(() => expect(firebase.auth.isAuthenticated).toHaveBeenCalled());
  if (userId) await waitFor(() => expect(firebase.auth.me).toHaveBeenCalled());
}

const printButtons = () => screen.queryAllByRole('button', { name: /print garage sale sign/i });

beforeEach(() => {
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
});

describe('ListingDetails sign printing', () => {
  it('is offered to the listing\'s seller', async () => {
    await renderListing({ userId: 'seller' });
    await waitFor(() => expect(printButtons().length).toBeGreaterThan(0));
  });

  it('is not offered to other users or visitors', async () => {
    await renderListing({ userId: 'someone-else' });
    expect(printButtons()).toHaveLength(0);
  });

  it('is not offered to visitors who are not signed in', async () => {
    await renderListing({ listing: publicCopy, userId: null });
    expect(printButtons()).toHaveLength(0);
  });
});

describe('ListingDetails address', () => {
  it('shows signed-in users the street address and directions', async () => {
    await renderListing();
    expect(screen.getByText('12 Example St')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /get directions/i }).length).toBeGreaterThan(0);
  });

  it('shows visitors the suburb only, and asks them to sign in for the address and directions', async () => {
    await renderListing({ listing: { ...publicCopy, approximate_location: true }, userId: null });
    expect(screen.getByText('Ocean Grove VIC 3226')).toBeInTheDocument();
    expect(screen.queryByText('12 Example St')).not.toBeInTheDocument();
    expect(screen.getByText(/to see the street address/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get directions/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /sign in for directions/i }).length).toBeGreaterThan(0);
  });
});

describe('ListingDetails back link', () => {
  it('goes home normally', async () => {
    await renderListing();
    expect(screen.getByRole('link', { name: /back to listings/i })).toHaveAttribute('href', '/Home');
  });

  it('goes back to the admin dashboard tab the listing was opened from', async () => {
    await renderListing({ url: '/ListingDetails?id=sale-1&adminTab=pending' });
    expect(screen.getByRole('link', { name: /back to listings/i })).toHaveAttribute('href', '/AdminDashboard?tab=pending');
  });

  it('ignores an unknown tab', async () => {
    await renderListing({ url: '/ListingDetails?id=sale-1&adminTab=evil' });
    expect(screen.getByRole('link', { name: /back to listings/i })).toHaveAttribute('href', '/Home');
  });
});

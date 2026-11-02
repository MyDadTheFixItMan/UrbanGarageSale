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

const sale = (status) => ({
  id: 'sale-1',
  title: 'Big sale',
  status,
  start_date: '2099-01-01',
  end_date: '2099-01-01',
  user_id: 'seller',
});

async function renderListing(status, { signedIn = true } = {}) {
  firebase.auth.isAuthenticated.mockResolvedValue(signedIn);
  firebase.auth.me.mockResolvedValue({ email: 'a@b.test' });
  firebase.entities.GarageSale.filter.mockResolvedValue([sale(status)]);
  firebase.entities.SavedListing.mine.mockResolvedValue([]);
  window.history.pushState({}, '', '/ListingDetails?id=sale-1');
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ListingDetails />
      </MemoryRouter>
    </QueryClientProvider>
  );
  await screen.findByRole('heading', { name: 'Big sale' });
  await waitFor(() => expect(firebase.auth.isAuthenticated).toHaveBeenCalled());
}

const saveButton = () => screen.queryByRole('button', { name: /favourites/i });

beforeEach(() => {
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
});

describe('ListingDetails favourites button', () => {
  it('shows on an active listing', async () => {
    await renderListing('active');

    await waitFor(() => expect(saveButton()).toBeInTheDocument());
  });

  it.each(['draft', 'pending_payment', 'pending_approval', 'completed', 'rejected'])('does not show on a %s listing', async (status) => {
    await renderListing(status);
    await waitFor(() => expect(firebase.auth.me).toHaveBeenCalled());

    expect(saveButton()).not.toBeInTheDocument();
  });

  it('does not show when signed out', async () => {
    await renderListing('active', { signedIn: false });

    expect(saveButton()).not.toBeInTheDocument();
  });
});

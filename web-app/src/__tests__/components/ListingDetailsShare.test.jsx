import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
// The flyer is drawn on a canvas, which jsdom doesn't have.
jest.mock('@/lib/shareFlyer', () => ({ createShareFlyer: jest.fn(async () => null) }));
jest.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }) => <div>{children}</div>;
  const Dialog = ({ open, children }) => (open ? <div>{children}</div> : null);
  return { Dialog, DialogContent: Pass, DialogDescription: Pass, DialogFooter: Pass, DialogHeader: Pass, DialogTitle: Pass };
});

const listing = {
  id: 'sale-1',
  title: 'Big sale',
  status: 'active',
  sale_type: 'garage_sale',
  address: '12 Example St',
  suburb: 'Ocean Grove',
  postcode: '3226',
  state: 'VIC',
  start_date: '2099-01-03',
  end_date: '2099-01-03',
  start_time: '08:00',
  end_time: '13:00',
  user_id: 'seller',
};
// What a visitor who isn't signed in gets: the public copy, without the address or seller.
const { address, user_id, ...publicCopy } = listing;

// The title is in the page twice (above the photos on phones, beside them on wider screens), so
// tests wait for it with findAllByRole.
const setNavigator = (key, value) => Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
const shareButtons = () => screen.queryAllByRole('button', { name: /share this listing/i });
const printButtons = () => screen.queryAllByRole('button', { name: /print garage sale sign/i });

function renderPage({ found = listing, userId = null, url = '/ListingDetails?id=sale-1' } = {}) {
  firebase.auth.isAuthenticated.mockResolvedValue(Boolean(userId));
  firebase.auth.me.mockResolvedValue({ id: userId, email: 'a@b.test' });
  firebase.entities.GarageSale.filter.mockResolvedValue(found ? [found] : []);
  firebase.entities.SavedListing.mine.mockResolvedValue([]);
  window.history.pushState({}, '', url);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ListingDetails />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
});

afterEach(() => {
  delete navigator.share;
});

describe('ListingDetails sharing', () => {
  it("lets visitors share straight from their device's share sheet, with a tagged link", async () => {
    setNavigator('share', jest.fn().mockResolvedValue(undefined));
    renderPage({ found: publicCopy });
    await screen.findAllByRole('heading', { name: 'Big sale' });
    await userEvent.click(shareButtons()[0]);
    expect(navigator.share).toHaveBeenCalledWith({
      title: 'Big sale',
      text: expect.stringContaining('Garage Sale in Ocean Grove VIC'),
      url: 'http://localhost/ListingDetails?id=sale-1&utm_source=share_sheet&utm_medium=share',
    });
    expect(screen.queryByText('Share this sale')).not.toBeInTheDocument();
  });

  it('gives visitors without a share sheet the other ways to share', async () => {
    renderPage({ found: publicCopy });
    await screen.findAllByRole('heading', { name: 'Big sale' });
    await userEvent.click(shareButtons()[0]);
    expect(await screen.findByText('Share this sale')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.queryByText('Flyer for Instagram')).not.toBeInTheDocument();
  });

  it('gives the seller every way to share, including the flyer', async () => {
    setNavigator('share', jest.fn());
    renderPage({ userId: 'seller' });
    await screen.findAllByRole('heading', { name: 'Big sale' });
    await waitFor(() => expect(printButtons().length).toBeGreaterThan(0));
    await userEvent.click(shareButtons()[0]);
    expect(await screen.findByText('Flyer for Instagram')).toBeInTheDocument();
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it("opens the share options from the seller's email link, then tidies the address", async () => {
    renderPage({ found: publicCopy, url: '/ListingDetails?id=sale-1&share=1' });
    expect(await screen.findByText('Share this sale')).toBeInTheDocument();
    expect(screen.getByText('Flyer for Instagram')).toBeInTheDocument();
    expect(window.location.search).toBe('?id=sale-1');
  });

  it("isn't offered before the sale is approved", async () => {
    renderPage({ found: { ...listing, status: 'pending_approval' }, userId: 'seller' });
    await screen.findAllByRole('heading', { name: 'Big sale' });
    await waitFor(() => expect(printButtons().length).toBeGreaterThan(0));
    expect(shareButtons()).toHaveLength(0);
  });
});

describe('ListingDetails finished sales', () => {
  it('says the sale has finished, and stops offering to share it', async () => {
    renderPage({ found: { ...listing, status: 'completed', start_date: '2020-01-04', end_date: '2020-01-04' }, userId: 'seller' });
    expect(await screen.findByText('This sale has finished.')).toBeInTheDocument();
    expect(shareButtons()).toHaveLength(0);
    expect(screen.getByRole('link', { name: /find sales near you/i })).toHaveAttribute('href', '/Home?near=me');
  });

  it('sends people from a link to a sale that has gone to the sales near them', async () => {
    renderPage({ found: null });
    expect(await screen.findByRole('heading', { name: 'This sale has finished' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /find sales near you/i })).toHaveAttribute('href', '/Home?near=me');
    expect(screen.getByRole('link', { name: /list your own sale/i })).toHaveAttribute('href', '/CreateListing');
  });
});

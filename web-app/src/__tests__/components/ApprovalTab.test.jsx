import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import ApprovalTab from '@/pages/admin/ApprovalTab';

jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    entities: { GarageSale: { page: jest.fn(), update: jest.fn(), reject: jest.fn() } },
    functions: { invoke: jest.fn() },
  },
}));

const listing = (overrides = {}) => ({
  id: 'sale-1',
  title: 'Big sale',
  address: '22 Shell Road',
  suburb: 'Ocean Grove',
  postcode: '3226',
  state: 'VIC',
  start_date: '2099-01-02',
  status: 'pending_approval',
  ...overrides,
});

async function openTab(sale) {
  firebase.entities.GarageSale.page.mockResolvedValue({ items: [sale], cursor: null, hasMore: false });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApprovalTab />
    </QueryClientProvider>
  );
  await screen.findByText('Big sale');
}

beforeEach(() => {
  jest.clearAllMocks();
  firebase.entities.GarageSale.update.mockResolvedValue({});
  firebase.functions.invoke.mockResolvedValue({});
});

describe('ApprovalTab', () => {
  it('labels an edited listing and warns that rejecting it ends the whole listing', async () => {
    await openTab(listing({ edited_after_approval: true }));
    expect(screen.getByText('Edited')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reject listing' }));

    expect(await screen.findByText(/ends the whole listing/i)).toBeInTheDocument();
  });

  it('shows neither on a new listing', async () => {
    await openTab(listing());
    expect(screen.queryByText('Edited')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reject listing' }));

    await screen.findByRole('heading', { name: 'Reject Listing' });
    expect(screen.queryByText(/ends the whole listing/i)).not.toBeInTheDocument();
  });

  it('clears the Edited label when approved', async () => {
    await openTab(listing({ edited_after_approval: true }));

    await userEvent.click(screen.getByRole('button', { name: 'Approve listing' }));

    await waitFor(() => expect(firebase.entities.GarageSale.update)
      .toHaveBeenCalledWith('sale-1', { status: 'active', edited_after_approval: false }));
  });
});

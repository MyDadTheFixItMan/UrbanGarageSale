import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import ApprovalTab from '@/pages/admin/ApprovalTab';

jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    entities: {
      GarageSale: { page: jest.fn(), getByIds: jest.fn(), update: jest.fn(), reject: jest.fn() },
      ListingEdit: { page: jest.fn(), approve: jest.fn(), refuse: jest.fn() },
    },
    functions: { invoke: jest.fn() },
  },
}));

const live = {
  id: 'sale-1',
  user_id: 'seller',
  title: 'Big sale',
  description: 'Tools',
  sale_type: 'garage_sale',
  address: '22 Shell Road',
  suburb: 'Ocean Grove',
  postcode: '3226',
  state: 'VIC',
  status: 'active',
  photos: [],
};
const edit = {
  id: 'sale-1',
  user_id: 'seller',
  title: 'Bigger sale',
  description: 'Tools',
  sale_type: 'yard_sale',
  photos: [],
  thumbnails: [],
  status: 'pending',
};
const pendingListing = { ...live, id: 'sale-2', title: 'New sale', status: 'pending_approval', start_date: '2099-01-02' };

function openTab({ listings = [], edits = [], editedListings = [] } = {}) {
  firebase.entities.GarageSale.page.mockResolvedValue({ items: listings, cursor: null });
  firebase.entities.ListingEdit.page.mockResolvedValue({ items: edits, cursor: null });
  firebase.entities.GarageSale.getByIds.mockResolvedValue(editedListings);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApprovalTab />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  firebase.entities.GarageSale.update.mockResolvedValue({});
  firebase.entities.ListingEdit.approve.mockResolvedValue();
  firebase.entities.ListingEdit.refuse.mockResolvedValue({ success: true, emailed: true });
  firebase.functions.invoke.mockResolvedValue({});
});

describe('ApprovalTab', () => {
  it('shows what changed on a live listing, apart from new listings', async () => {
    openTab({ listings: [pendingListing], edits: [edit], editedListings: [live] });

    expect(await screen.findByText('Edits to live listings')).toBeInTheDocument();
    expect(screen.getByText('Edited')).toBeInTheDocument();
    expect(screen.getByText('Bigger sale')).toBeInTheDocument();
    expect(screen.getByText('Yard Sale')).toBeInTheDocument();
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
    expect(screen.getByText('New sale')).toBeInTheDocument();
  });

  it('puts approved changes live and tells the seller', async () => {
    openTab({ edits: [edit], editedListings: [live] });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve changes' }));

    await waitFor(() => expect(firebase.entities.ListingEdit.approve).toHaveBeenCalledWith(edit));
    await waitFor(() => expect(firebase.functions.invoke).toHaveBeenCalledWith('sendApprovalEmail', { saleId: 'sale-1' }));
    expect(firebase.entities.GarageSale.update).not.toHaveBeenCalled();
  });

  it('refuses changes with a reason, without touching the listing or refunding', async () => {
    openTab({ edits: [edit], editedListings: [live] });

    await userEvent.click(await screen.findByRole('button', { name: 'Refuse changes' }));
    expect(await screen.findByText(/no refund is made/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Reason'), 'Misleading title');
    await userEvent.click(screen.getByRole('button', { name: 'Refuse' }));

    await waitFor(() => expect(firebase.entities.ListingEdit.refuse).toHaveBeenCalledWith('sale-1', 'Misleading title'));
    expect(firebase.entities.GarageSale.reject).not.toHaveBeenCalled();
  });

  it('skips an edit whose listing is no longer live', async () => {
    openTab({ edits: [edit], editedListings: [{ ...live, status: 'completed' }] });

    expect(await screen.findByText('No pending listings')).toBeInTheDocument();
    expect(screen.queryByText('Edited')).not.toBeInTheDocument();
  });

  it('still approves new listings', async () => {
    openTab({ listings: [pendingListing] });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve listing' }));

    await waitFor(() => expect(firebase.entities.GarageSale.update).toHaveBeenCalledWith('sale-2', { status: 'active' }));
  });
});

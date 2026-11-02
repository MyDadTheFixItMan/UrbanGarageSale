import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { geocode } from '@/lib/geocode';
import { toast } from 'sonner';
import CreateListing from '@/pages/CreateListing';

jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    auth: {
      isAuthenticated: jest.fn(),
      me: jest.fn(),
      is2FAEnabled: jest.fn(),
      hasSecondFactorSession: jest.fn(),
    },
    entities: {
      AppSettings: { get: jest.fn() },
      GarageSale: { filter: jest.fn(), update: jest.fn() },
    },
    firestore: { collection: () => ({ getDocs: async () => [] }) },
  },
}));
jest.mock('@/lib/geocode', () => ({ geocode: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/GooglePlacesAutocomplete', () => function MockAutocomplete({ id, value, disabled }) {
  return <input id={id} defaultValue={value} disabled={disabled} />;
});
jest.mock('@/pages/createListing/PhotosSection', () => function MockPhotos() {
  return <div>Photos</div>;
});

const listing = (overrides = {}) => ({
  id: 'sale-1',
  user_id: 'seller',
  title: 'Big sale',
  description: 'Lots of tools',
  sale_type: 'garage_sale',
  address: '22 Shell Road',
  suburb: '',
  postcode: '',
  state: 'VIC',
  start_date: '2099-01-02',
  end_date: '2099-01-02',
  start_time: '08:00',
  end_time: '15:00',
  photos: ['https://example.test/1.jpg'],
  thumbnails: ['https://example.test/1-thumb.jpg'],
  status: 'active',
  payment_status: 'paid',
  ...overrides,
});

async function openEditor(sale) {
  firebase.entities.GarageSale.filter.mockResolvedValue([sale]);
  window.history.pushState({}, '', '/CreateListing?edit=sale-1');
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreateListing />
    </QueryClientProvider>
  );
  await screen.findByLabelText('Title *');
}

beforeEach(() => {
  jest.clearAllMocks();
  firebase.auth.isAuthenticated.mockResolvedValue(true);
  firebase.auth.me.mockResolvedValue({ id: 'seller', email: 'a@b.test' });
  firebase.auth.is2FAEnabled.mockResolvedValue(true);
  firebase.auth.hasSecondFactorSession.mockResolvedValue(true);
  firebase.entities.AppSettings.get.mockResolvedValue({ is_active: true, free_listing_start: '2099-01-01', free_listing_end: '2099-12-31' });
  firebase.entities.GarageSale.update.mockResolvedValue();
});

describe('editing a live listing', () => {
  it('leaves the title, description and sale type open and locks everything else', async () => {
    await openEditor(listing());

    expect(screen.getByRole('heading', { name: 'Edit Listing' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title *')).toBeEnabled();
    expect(screen.getByLabelText('Description')).toBeEnabled();
    expect(screen.getByLabelText('Select sale type')).toBeEnabled();
    for (const label of ['Street Address *', 'State', 'Start Date *', 'End Date *', 'Daily Start Time', 'Daily End Time']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByLabelText('Suburb & Postcode')).toHaveAttribute('readonly');
  });

  it('warns the listing will be hidden and offers one button, with no draft, publish or pricing options', async () => {
    await openEditor(listing());

    expect(screen.getByText(/hidden from buyers/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send for Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/to publish/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/free listing period/i)).not.toBeInTheDocument();
  });

  it('sends only the editable fields for approval, even when the address details are incomplete', async () => {
    await openEditor(listing());
    await userEvent.type(screen.getByLabelText('Title *'), ' today');
    await userEvent.click(screen.getByRole('button', { name: 'Send for Approval' }));

    await waitFor(() => expect(firebase.entities.GarageSale.update).toHaveBeenCalled());
    expect(firebase.entities.GarageSale.update).toHaveBeenCalledWith('sale-1', {
      title: 'Big sale today',
      description: 'Lots of tools',
      sale_type: 'garage_sale',
      photos: ['https://example.test/1.jpg'],
      thumbnails: ['https://example.test/1-thumb.jpg'],
      status: 'pending_approval',
      edited_after_approval: true,
    });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('leaves the listing live when nothing was changed', async () => {
    await openEditor(listing());
    await userEvent.click(screen.getByRole('button', { name: 'Send for Approval' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('No changes to save'));
    expect(firebase.entities.GarageSale.update).not.toHaveBeenCalled();
  });
});

describe('editing a listing already awaiting approval', () => {
  it('saves the changes without a warning, leaving its status alone', async () => {
    await openEditor(listing({ status: 'pending_approval' }));
    expect(screen.queryByText(/hidden from buyers/i)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Title *'), ' today');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(firebase.entities.GarageSale.update).toHaveBeenCalled());
    expect(firebase.entities.GarageSale.update.mock.calls[0][1]).not.toHaveProperty('status');
  });
});

describe('editing a draft', () => {
  it('keeps every field open and the draft and publish buttons', async () => {
    await openEditor(listing({ status: 'draft', payment_status: 'pending' }));

    expect(screen.getByRole('heading', { name: 'Create Listing' })).toBeInTheDocument();
    expect(screen.getByLabelText('Start Date *')).toBeEnabled();
    expect(screen.getByLabelText('Street Address *')).toBeEnabled();
    expect(screen.getByRole('button', { name: /save as draft/i })).toBeInTheDocument();
  });
});

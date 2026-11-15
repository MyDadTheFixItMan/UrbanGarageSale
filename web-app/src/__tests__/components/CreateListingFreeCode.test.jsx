import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { firebase } from '@/api/firebaseClient';
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
      ListingEdit: { get: jest.fn() },
      FreeListingCode: { check: jest.fn(), redeem: jest.fn() },
    },
    functions: { invoke: jest.fn() },
    firestore: { collection: () => ({ getDocs: async () => [] }) },
  },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/GooglePlacesAutocomplete', () => function MockAutocomplete({ id, value, disabled }) {
  return <input id={id} defaultValue={value} disabled={disabled} />;
});
jest.mock('@/pages/createListing/PhotosSection', () => function MockPhotos() {
  return <div>Photos</div>;
});

// A draft with everything filled in, ready to publish.
const draft = (overrides = {}) => ({
  id: 'sale-1',
  user_id: 'seller',
  title: 'Big sale',
  description: 'Lots of tools',
  sale_type: 'garage_sale',
  address: '22 Shell Road, Ocean Grove VIC 3226',
  suburb: 'Ocean Grove',
  postcode: '3226',
  state: 'VIC',
  latitude: -38.26,
  longitude: 144.52,
  start_date: '2099-01-02',
  end_date: '2099-01-02',
  start_time: '08:00',
  end_time: '15:00',
  photos: ['https://example.test/1.jpg', 'https://example.test/2.jpg'],
  thumbnails: [],
  status: 'draft',
  payment_status: 'pending',
  ...overrides,
});

async function openDraft(settings = { is_active: false }) {
  firebase.entities.AppSettings.get.mockResolvedValue(settings);
  firebase.entities.GarageSale.filter.mockResolvedValue([draft()]);
  window.history.pushState({}, '', '/CreateListing?edit=sale-1');
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CreateListing />
      </MemoryRouter>
    </QueryClientProvider>
  );
  await screen.findByLabelText('Title *');
}

async function applyCode(code) {
  await userEvent.click(screen.getByRole('button', { name: 'Have a free listing code?' }));
  await userEvent.type(screen.getByLabelText('Free listing code'), code);
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await screen.findByText(/Code FREE-AAAA-BBBB applied/);
}

beforeEach(() => {
  jest.clearAllMocks();
  firebase.auth.isAuthenticated.mockResolvedValue(true);
  firebase.auth.me.mockResolvedValue({
    id: 'seller', email: 'a@b.test', full_name: 'Sam Lee', phone: '+61412345678',
    address: '1 Main St', suburb: 'Carlton', postcode: '3053', state: 'VIC',
  });
  firebase.auth.is2FAEnabled.mockResolvedValue(true);
  firebase.auth.hasSecondFactorSession.mockResolvedValue(true);
  firebase.entities.GarageSale.update.mockResolvedValue({});
  firebase.entities.ListingEdit.get.mockResolvedValue(null);
  firebase.entities.FreeListingCode.check.mockResolvedValue({ code: 'FREE-AAAA-BBBB', expiresOn: '2099-01-31' });
  firebase.entities.FreeListingCode.redeem.mockResolvedValue({ success: true });
});

describe('publishing with a free listing code', () => {
  it('saves the listing, then publishes it with the code instead of going to checkout', async () => {
    await openDraft();
    await applyCode('free-aaaa-bbbb');

    await userEvent.click(screen.getByRole('button', { name: 'Publish FREE' }));

    await waitFor(() => expect(firebase.entities.FreeListingCode.redeem).toHaveBeenCalledWith('sale-1', 'FREE-AAAA-BBBB'));
    expect(firebase.entities.GarageSale.update).toHaveBeenCalledWith('sale-1', expect.objectContaining({
      status: 'pending_payment', payment_status: 'pending',
    }));
    expect(firebase.functions.invoke).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Free listing code used/)));
  });

  it("doesn't use the code when the listing is only saved as a draft", async () => {
    await openDraft();
    await applyCode('FREE-AAAA-BBBB');

    await userEvent.click(screen.getByRole('button', { name: 'Save as Draft' }));

    await waitFor(() => expect(firebase.entities.GarageSale.update).toHaveBeenCalled());
    expect(firebase.entities.FreeListingCode.redeem).not.toHaveBeenCalled();
  });

  it('offers no code when a free period for the sale\'s state already makes it free', async () => {
    await openDraft({
      is_active: false,
      free_listing_states: { VIC: { is_active: true, free_listing_start: '2099-01-01', free_listing_end: '2099-01-31' } },
    });

    expect(await screen.findByText(/Free Listing Period Active/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Have a free listing code?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish FREE' })).toBeInTheDocument();
  });
});

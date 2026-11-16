import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { firebase } from '@/api/firebaseClient';
import { toast } from 'sonner';
import FreeListingCodesCard from '@/pages/admin/FreeListingCodesCard';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { entities: { FreeListingCode: { recent: jest.fn(), create: jest.fn(), cancel: jest.fn() } } },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));

const unused = {
  id: 'FREE-AAAA-BBBB', code: 'FREE-AAAA-BBBB', status: 'unused',
  recipient_name: 'Sam Lee', recipient_email: 'sam@example.test', expires_on: '2099-01-31',
};
const used = { id: 'FREE-CCCC-DDDD', code: 'FREE-CCCC-DDDD', status: 'used', used_for: 'sale-1', expires_on: '2099-01-31' };

function renderCard(codes = []) {
  firebase.entities.FreeListingCode.recent.mockResolvedValue(codes);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <FreeListingCodesCard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  firebase.entities.FreeListingCode.cancel.mockResolvedValue({ success: true });
});

describe('FreeListingCodesCard', () => {
  it('lists the codes sent, who to, and whether they were used', async () => {
    renderCard([unused, used]);

    expect(await screen.findByText('FREE-AAAA-BBBB')).toBeInTheDocument();
    expect(screen.getByText('Sam Lee · sam@example.test')).toBeInTheDocument();
    expect(screen.getByText('Not used yet')).toBeInTheDocument();
    expect(screen.getByText('Use by 31 Jan 2099')).toBeInTheDocument();
    expect(screen.getByText('FREE-CCCC-DDDD')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View listing' })).toHaveAttribute('href', '/ListingDetails?id=sale-1');
  });

  it('makes a code, emails it to the person and shows it to copy', async () => {
    firebase.entities.FreeListingCode.create.mockResolvedValue({ code: 'FREE-EEEE-FFFF', emailed: true, expiresOn: '2099-03-01' });
    renderCard();

    await userEvent.type(screen.getByLabelText('Their name (optional)'), 'Sam Lee');
    await userEvent.type(screen.getByLabelText('Their email (to send the code)'), 'sam@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Create & Email Code' }));

    await waitFor(() => expect(firebase.entities.FreeListingCode.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sam Lee', email: 'sam@example.test', note: '' })
    ));
    expect(firebase.entities.FreeListingCode.create.mock.calls[0][0].expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText('FREE-EEEE-FFFF')).toBeInTheDocument();
    expect(screen.getByText(/Emailed to sam@example\.test\./)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Code FREE-EEEE-FFFF emailed to sam@example.test');
    expect(screen.getByLabelText('Their email (to send the code)')).toHaveValue('');
  });

  it('makes a code without emailing it when no address is given', async () => {
    firebase.entities.FreeListingCode.create.mockResolvedValue({ code: 'FREE-GGGG-HHHH', emailed: false, expiresOn: '2099-03-01' });
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Create Code' }));

    expect(await screen.findByText('FREE-GGGG-HHHH')).toBeInTheDocument();
    expect(screen.getByText(/Not emailed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('cancels an unused code once the admin confirms', async () => {
    renderCard([unused]);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel code' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel code' }));

    await waitFor(() => expect(firebase.entities.FreeListingCode.cancel).toHaveBeenCalledWith('FREE-AAAA-BBBB'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Code cancelled'));
  });
});

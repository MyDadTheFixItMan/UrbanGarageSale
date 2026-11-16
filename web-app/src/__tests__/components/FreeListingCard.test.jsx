import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { toast } from 'sonner';
import FreeListingCard from '@/pages/admin/FreeListingCard';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { entities: { AppSettings: { update: jest.fn() } } },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

function renderCard(appSettings) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FreeListingCard appSettings={appSettings} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  firebase.entities.AppSettings.update.mockResolvedValue({});
});

describe('FreeListingCard', () => {
  it('shows all of Australia and every state, each with its saved period', () => {
    renderCard({
      is_active: false,
      free_listing_states: { VIC: { is_active: true, free_listing_start: '2099-12-01', free_listing_end: '2099-12-10' } },
    });

    expect(screen.getByLabelText('Free listings: All of Australia')).not.toBeChecked();
    expect(screen.getByLabelText('Free listings: Victoria')).toBeChecked();
    for (const state of ['New South Wales', 'Queensland', 'South Australia', 'Western Australia', 'Tasmania',
      'Australian Capital Territory', 'Northern Territory']) {
      expect(screen.getByLabelText(`Free listings: ${state}`)).not.toBeChecked();
    }
    expect(screen.getByText('Scheduled · 1 Dec 2099 – 10 Dec 2099')).toBeInTheDocument();
  });

  it('saves a free period for one state, with every other state switched off', async () => {
    renderCard({});

    await userEvent.click(screen.getByLabelText('Free listings: Queensland'));
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2099-12-01' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2099-12-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => expect(firebase.entities.AppSettings.update).toHaveBeenCalled());
    const saved = firebase.entities.AppSettings.update.mock.calls[0][0];
    expect(saved).toMatchObject({ is_active: false });
    expect(saved.free_listing_states.QLD).toEqual({ is_active: true, free_listing_start: '2099-12-01', free_listing_end: '2099-12-10' });
    expect(saved.free_listing_states.VIC).toEqual({ is_active: false, free_listing_start: '', free_listing_end: '' });
    expect(Object.keys(saved.free_listing_states).sort()).toEqual(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Free listing periods saved'));
  });

  it("won't save a period that is on without its dates", async () => {
    renderCard({});

    await userEvent.click(screen.getByLabelText('Free listings: Tasmania'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect(toast.error).toHaveBeenCalledWith('Tasmania needs a start and an end date');
    expect(firebase.entities.AppSettings.update).not.toHaveBeenCalled();
  });
});

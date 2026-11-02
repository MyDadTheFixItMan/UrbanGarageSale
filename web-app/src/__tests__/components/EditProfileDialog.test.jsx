import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { geocode } from '@/lib/geocode';
import { EditProfileDialog } from '@/pages/profile/ProfileDialogs';

jest.mock('@/api/firebaseClient', () => ({ firebase: { auth: { updateProfile: jest.fn() } } }));
jest.mock('@/lib/geocode', () => ({ geocode: jest.fn() }));
jest.mock('@/utils/printGarageSaleSign', () => ({ paperSizes: {} }));
jest.mock('@/components/GooglePlacesAutocomplete', () => function MockAutocomplete({ value, onChange, id }) {
  return <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />;
});

const located = (postcode, state, suburb = 'Ocean Grove') => ({
  components: [
    { short_name: suburb, types: ['locality'] },
    { short_name: state, types: ['administrative_area_level_1'] },
    { short_name: postcode, types: ['postal_code'] },
  ],
});

async function saveProfile(user, newAddress) {
  const onSaved = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditProfileDialog user={user} onSaved={onSaved} />
    </QueryClientProvider>
  );
  await userEvent.click(screen.getByRole('button', { name: /edit profile/i }));
  if (newAddress) {
    const address = screen.getByLabelText('Address');
    await userEvent.clear(address);
    await userEvent.type(address, newAddress);
  }
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  return onSaved.mock.calls[0][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  firebase.auth.updateProfile.mockResolvedValue();
});

describe('EditProfileDialog', () => {
  it('fills in a missing postcode and state when saving, as for accounts saved without them', async () => {
    geocode.mockResolvedValue(located('3226', 'VIC'));

    const saved = await saveProfile({ address: '26 Seawind Place Ocean Grove', postcode: '', state: '' });

    expect(firebase.auth.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ postcode: '3226', state: 'VIC' }));
    expect(saved).toEqual(expect.objectContaining({ postcode: '3226', state: 'VIC' }));
  });

  it('replaces the old postcode and state when the address is edited', async () => {
    geocode.mockResolvedValue(located('2000', 'NSW', 'Sydney'));

    await saveProfile({ address: '26 Seawind Place', suburb: 'Ocean Grove', postcode: '3226', state: 'VIC' }, '1 George St Sydney');

    expect(firebase.auth.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ suburb: 'Sydney', postcode: '2000', state: 'NSW' }));
  });

  it('leaves a complete address alone', async () => {
    await saveProfile({ address: '26 Seawind Place', suburb: 'Ocean Grove', postcode: '3226', state: 'VIC' });

    expect(geocode).not.toHaveBeenCalled();
  });
});

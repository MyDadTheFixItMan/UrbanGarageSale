import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { geocode } from '@/lib/geocode';
import { toast } from 'sonner';
import { EditProfileDialog, CompleteProfileDialog } from '@/pages/profile/ProfileDialogs';

jest.mock('@/api/firebaseClient', () => ({ firebase: { auth: { updateProfile: jest.fn() } } }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
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

const NAMED = { full_name: 'Sam Lee', phone: '+61412345678' };

function openDialog(user) {
  const onSaved = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditProfileDialog user={{ ...NAMED, ...user }} onSaved={onSaved} />
    </QueryClientProvider>
  );
  return onSaved;
}

async function saveProfile(user, newAddress) {
  const onSaved = openDialog(user);
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

  it('refuses to clear the name or the phone number', async () => {
    openDialog({ address: '26 Seawind Place', suburb: 'Ocean Grove', postcode: '3226', state: 'VIC' });
    await userEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(toast.error).toHaveBeenLastCalledWith('Please enter your name');

    await userEvent.type(screen.getByLabelText('Name'), 'Sam');
    await userEvent.clear(screen.getByLabelText('Phone Number'));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(toast.error).toHaveBeenLastCalledWith('Please enter your phone number');
    expect(firebase.auth.updateProfile).not.toHaveBeenCalled();
  });

  it('saves a local mobile number in +61 form', async () => {
    const onSaved = openDialog({ address: '26 Seawind Place', suburb: 'Ocean Grove', postcode: '3226', state: 'VIC' });
    await userEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    const phone = screen.getByLabelText('Phone Number');
    await userEvent.clear(phone);
    await userEvent.type(phone, '0491 570 156');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(firebase.auth.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ phone: '+61491570156' }));
  });
});

describe('CompleteProfileDialog', () => {
  // A new Google, Facebook or Apple account: a name and email, but no phone or address.
  const OAUTH_USER = { full_name: 'Sam Lee', email: 'sam@example.com' };

  function openRequired(user = OAUTH_USER) {
    const onSaved = jest.fn();
    const onSignOut = jest.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CompleteProfileDialog user={user} onSaved={onSaved} onSignOut={onSignOut} />
      </QueryClientProvider>
    );
    return { onSaved, onSignOut };
  }

  it("is open straight away and can't be closed", async () => {
    openRequired();
    expect(screen.getByRole('dialog', { name: 'Complete your profile' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Complete your profile' })).toBeVisible();
  });

  it('needs a phone number and an address before saving', async () => {
    openRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Save and Continue' }));
    expect(toast.error).toHaveBeenLastCalledWith('Please enter your phone number');

    await userEvent.type(screen.getByLabelText('Phone Number'), '0412 345 678');
    await userEvent.click(screen.getByRole('button', { name: 'Save and Continue' }));
    expect(toast.error).toHaveBeenLastCalledWith('Please enter your address');
    expect(firebase.auth.updateProfile).not.toHaveBeenCalled();
  });

  it("refuses an address whose suburb, postcode and state can't be found", async () => {
    geocode.mockRejectedValue(new Error('no match'));
    openRequired();
    await userEvent.type(screen.getByLabelText('Phone Number'), '0412 345 678');
    await userEvent.type(screen.getByLabelText('Address'), 'somewhere');
    await userEvent.click(screen.getByRole('button', { name: 'Save and Continue' }));
    await waitFor(() => expect(toast.error).toHaveBeenLastCalledWith(expect.stringMatching(/pick it from the suggestions/)));
    expect(firebase.auth.updateProfile).not.toHaveBeenCalled();
  });

  it('saves the completed profile', async () => {
    geocode.mockResolvedValue(located('3226', 'VIC'));
    const { onSaved } = openRequired();
    await userEvent.type(screen.getByLabelText('Phone Number'), '0412 345 678');
    await userEvent.type(screen.getByLabelText('Address'), '26 Seawind Place Ocean Grove');
    await userEvent.click(screen.getByRole('button', { name: 'Save and Continue' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(firebase.auth.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Sam Lee', phone: '+61412345678', suburb: 'Ocean Grove', postcode: '3226', state: 'VIC',
    }));
  });

  it('lets them sign out instead', async () => {
    const { onSignOut } = openRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });
});

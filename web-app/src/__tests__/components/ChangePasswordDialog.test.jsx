import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { auth: { changePassword: jest.fn(), resetPassword: jest.fn(), updateProfile: jest.fn() } },
}));
jest.mock('@/components/GooglePlacesAutocomplete', () => () => null);
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import { firebase } from '@/api/firebaseClient';
import { toast } from 'sonner';
import { ChangePasswordDialog } from '@/pages/profile/ProfileDialogs';

async function openDialog() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ChangePasswordDialog email="seller@example.com" />
    </QueryClientProvider>
  );
  await userEvent.click(screen.getByRole('button', { name: /change password/i }));
}

async function fill({ current = 'old-password-1', next = 'new-password-123', confirm = next } = {}) {
  if (current) await userEvent.type(screen.getByLabelText('Current Password'), current);
  if (next) await userEvent.type(screen.getByLabelText('New Password'), next);
  if (confirm) await userEvent.type(screen.getByLabelText('Confirm New Password'), confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Update Password' }));
}

beforeEach(() => jest.clearAllMocks());

describe('ChangePasswordDialog', () => {
  it('changes the password and closes when the form is valid', async () => {
    firebase.auth.changePassword.mockResolvedValue();
    await openDialog();
    await fill();
    await waitFor(() => expect(firebase.auth.changePassword).toHaveBeenCalledWith('old-password-1', 'new-password-123'));
    await waitFor(() => expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Password changed successfully');
  });

  it('enforces the shared password rule before contacting Firebase', async () => {
    await openDialog();
    await fill({ next: 'short1' });
    expect(screen.getByRole('alert')).toHaveTextContent('at least 12 characters');
    expect(firebase.auth.changePassword).not.toHaveBeenCalled();
  });

  it('catches a mistyped confirmation', async () => {
    await openDialog();
    await fill({ confirm: 'new-password-124' });
    expect(screen.getByRole('alert')).toHaveTextContent('New passwords do not match');
    expect(firebase.auth.changePassword).not.toHaveBeenCalled();
  });

  it('shows Firebase errors such as a wrong current password', async () => {
    firebase.auth.changePassword.mockRejectedValue(new Error('Current password is incorrect'));
    await openDialog();
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
  });

  it('can send a reset email to the account address instead', async () => {
    firebase.auth.resetPassword.mockResolvedValue();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }));
    await waitFor(() => expect(firebase.auth.resetPassword).toHaveBeenCalledWith('seller@example.com'));
    expect(toast.success).toHaveBeenCalledWith('Password reset email sent to your inbox');
  });
});

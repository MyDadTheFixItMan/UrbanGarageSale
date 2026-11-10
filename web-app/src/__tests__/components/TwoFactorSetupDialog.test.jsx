import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    auth: {
      isEmailVerified: jest.fn(),
      sendVerificationEmail: jest.fn(),
      startMfaEnrollment: jest.fn(),
      finishMfaEnrollment: jest.fn(),
    },
  },
}));

import { firebase } from '@/api/firebaseClient';
import TwoFactorSetupDialog from '@/components/TwoFactorSetupDialog';

const VERIFIED_BUTTON = "I've verified my email";

const renderDialog = () => render(
  <TwoFactorSetupDialog open onOpenChange={() => {}} defaultPhone="+61491570156" onEnabled={() => {}} />
);

beforeEach(() => jest.clearAllMocks());

describe('TwoFactorSetupDialog', () => {
  it('goes straight to the mobile number when the email is verified', async () => {
    firebase.auth.isEmailVerified.mockResolvedValue(true);
    renderDialog();
    await waitFor(() => expect(firebase.auth.isEmailVerified).toHaveBeenCalled());
    expect(screen.getByLabelText('Mobile number')).toBeInTheDocument();
  });

  it('starts at the email step when the email is not verified', async () => {
    firebase.auth.isEmailVerified.mockResolvedValue(false);
    renderDialog();
    expect(await screen.findByRole('button', { name: VERIFIED_BUTTON })).toBeInTheDocument();
  });

  it('says so when the email still is not verified', async () => {
    firebase.auth.isEmailVerified.mockResolvedValue(false);
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: VERIFIED_BUTTON }));
    expect(await screen.findByText(/not verified yet/i)).toBeInTheDocument();
    expect(firebase.auth.startMfaEnrollment).not.toHaveBeenCalled();
  });

  it('moves on to the mobile number once the email is verified', async () => {
    firebase.auth.isEmailVerified.mockResolvedValueOnce(false).mockResolvedValue(true);
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: VERIFIED_BUTTON }));
    expect(await screen.findByLabelText('Mobile number')).toBeInTheDocument();
  });

  it('confirms when the verification email is resent', async () => {
    firebase.auth.isEmailVerified.mockResolvedValue(false);
    firebase.auth.sendVerificationEmail.mockResolvedValue();
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Resend verification email' }));
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
  });

  it('goes back to the number when a resend fails, rather than saying the code was sent', async () => {
    firebase.auth.isEmailVerified.mockResolvedValue(true);
    firebase.auth.startMfaEnrollment.mockResolvedValueOnce().mockRejectedValueOnce(new Error('Could not send the SMS code'));
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Send code' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Resend code' }));
    expect(await screen.findByText('Could not send the SMS code')).toBeInTheDocument();
    expect(screen.queryByText(/code sent to/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mobile number')).toBeInTheDocument();
  });

  it('shows the reason when the verification email cannot be sent', async () => {
    firebase.auth.isEmailVerified.mockResolvedValue(false);
    firebase.auth.sendVerificationEmail.mockRejectedValue(new Error('Please wait a few minutes'));
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Resend verification email' }));
    expect(await screen.findByText('Please wait a few minutes')).toBeInTheDocument();
  });
});

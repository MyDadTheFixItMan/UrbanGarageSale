import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    auth: {
      isEmailVerified: jest.fn(),
      sendVerificationEmail: jest.fn(),
      startMfaEnrollment: jest.fn(),
      prepareRecaptcha: jest.fn(),
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

describe('TwoFactorSetupDialog when 2FA is required', () => {
  const renderRequired = ({ autoSend = true, onEnabled = jest.fn(), onSignOut = jest.fn() } = {}) => {
    render(
      <TwoFactorSetupDialog open required autoSend={autoSend} defaultPhone="+61491570156"
        onEnabled={onEnabled} onSignOut={onSignOut} />
    );
    return { onEnabled, onSignOut };
  };

  beforeEach(() => {
    firebase.auth.isEmailVerified.mockResolvedValue(true);
    firebase.auth.prepareRecaptcha.mockResolvedValue();
    firebase.auth.startMfaEnrollment.mockResolvedValue();
  });

  it('texts the code to the profile mobile straight away, without asking for the number', async () => {
    renderRequired();
    expect(await screen.findByLabelText('Code sent to +61491570156')).toBeInTheDocument();
    expect(firebase.auth.startMfaEnrollment).toHaveBeenCalledTimes(1);
    expect(firebase.auth.startMfaEnrollment).toHaveBeenCalledWith('+61491570156', 'recaptcha-container-2fa');
    expect(firebase.auth.prepareRecaptcha).toHaveBeenCalledTimes(1);
  });

  it('waits for the Send button when the code was just sent', async () => {
    renderRequired({ autoSend: false });
    expect(await screen.findByRole('button', { name: 'Send code' })).toBeInTheDocument();
    expect(firebase.auth.startMfaEnrollment).not.toHaveBeenCalled();
  });

  it("can't be closed, only finished or left by signing out", async () => {
    const { onSignOut } = renderRequired();
    await screen.findByLabelText('Code sent to +61491570156');
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Turn on two-step sign-in' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('can use a different number', async () => {
    const { onEnabled } = renderRequired();
    await userEvent.click(await screen.findByRole('button', { name: 'Use a different number' }));
    const number = screen.getByLabelText('Mobile number');
    await userEvent.clear(number);
    await userEvent.type(number, '0412345678');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(firebase.auth.startMfaEnrollment).toHaveBeenLastCalledWith('0412345678', 'recaptcha-container-2fa');

    firebase.auth.finishMfaEnrollment.mockResolvedValue({ signInAgain: false });
    await userEvent.type(await screen.findByLabelText('Code sent to 0412345678'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on 2FA' }));
    await waitFor(() => expect(onEnabled).toHaveBeenCalledWith({ signInAgain: false, phone: '0412345678' }));
  });

  it('sends the code once the email is verified, for accounts made with email and password', async () => {
    firebase.auth.isEmailVerified.mockResolvedValueOnce(false).mockResolvedValue(true);
    firebase.auth.startMfaEnrollment.mockRejectedValueOnce(Object.assign(new Error('verify'), { emailNotVerified: true }));
    renderRequired();
    await userEvent.click(await screen.findByRole('button', { name: VERIFIED_BUTTON }));
    expect(await screen.findByLabelText('Code sent to +61491570156')).toBeInTheDocument();
  });
});

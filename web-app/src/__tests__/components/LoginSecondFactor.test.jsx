import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }));
jest.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ checkAppState: jest.fn() }) }));
jest.mock('@/pages/login/OAuthButtons', () => ({ __esModule: true, default: () => null, signInWithProvider: jest.fn() }));
jest.mock('@/pages/login/SignUpForm', () => () => null);
jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    auth: {
      login: jest.fn(),
      sendMfaSignInCode: jest.fn(),
      completeMfaSignIn: jest.fn(),
    },
  },
}));

import { firebase } from '@/api/firebaseClient';
import Login from '@/pages/Login';

const mfaRequired = Object.assign(new Error('2FA needed'), { mfaRequired: true, phoneHint: '+61 ••• ••• 515' });

async function signIn() {
  render(<MemoryRouter><Login /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText('Email Address'), 'seller@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'a-long-password-1');
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

beforeEach(() => jest.clearAllMocks());

describe('Login with 2FA', () => {
  it('shows the code is being sent, then that it has gone', async () => {
    let sent;
    firebase.auth.login.mockRejectedValue(mfaRequired);
    firebase.auth.sendMfaSignInCode.mockReturnValue(new Promise((resolve) => { sent = resolve; }));
    await signIn();

    expect(await screen.findByText('Sending a 6-digit code to your phone:')).toBeInTheDocument();
    sent();
    expect(await screen.findByText('We sent a 6-digit code to your phone:')).toBeInTheDocument();
  });

  it('does not leave the Sign In button stuck when the user goes back before the code is sent', async () => {
    firebase.auth.login.mockRejectedValue(mfaRequired);
    firebase.auth.sendMfaSignInCode.mockReturnValue(new Promise(() => {}));
    await signIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Back to Sign In' }));
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });
});

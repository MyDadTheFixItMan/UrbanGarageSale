import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    auth: {
      completeMfaSignIn: jest.fn(),
      sendMfaSignInCode: jest.fn(),
    },
  },
}));

import { firebase } from '@/api/firebaseClient';
import SecondFactorDialog, { RECAPTCHA_CONTAINER_ID, RESEND_COOLDOWN_SECONDS } from '@/pages/login/SecondFactorDialog';

const renderDialog = (props = {}) => {
  const onVerified = jest.fn();
  const onCancel = jest.fn();
  render(
    <SecondFactorDialog phoneHint="+61 ••• ••• 156" error="" onVerified={onVerified} onCancel={onCancel} {...props} />
  );
  return { onVerified, onCancel };
};

const enterCode = (code) => userEvent.type(screen.getByLabelText('Verification Code'), code);

beforeEach(() => jest.clearAllMocks());

describe('SecondFactorDialog', () => {
  it('opens as a popup showing where the code went, ready to type in', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Enter Verification Code' })).toBeInTheDocument();
    expect(screen.getByText('+61 ••• ••• 156')).toBeInTheDocument();
    expect(screen.getByLabelText('Verification Code')).toHaveFocus();
  });

  it('finishes signing in with the code', async () => {
    firebase.auth.completeMfaSignIn.mockResolvedValue({});
    const { onVerified } = renderDialog();
    await enterCode('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(firebase.auth.completeMfaSignIn).toHaveBeenCalledWith('123456');
  });

  it('asks for all six digits before checking', async () => {
    renderDialog();
    await enterCode('123');
    await userEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    expect(screen.getByText('Please enter the 6-digit code')).toBeInTheDocument();
    expect(firebase.auth.completeMfaSignIn).not.toHaveBeenCalled();
  });

  it('stays open and says why when the code is wrong', async () => {
    firebase.auth.completeMfaSignIn.mockRejectedValue(new Error('That code is not right.'));
    const { onVerified } = renderDialog();
    await enterCode('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    expect(await screen.findByText('That code is not right.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('shows the error when the code could not be sent', () => {
    renderDialog({ error: 'Too many attempts.' });
    expect(screen.getByText('Too many attempts.')).toBeInTheDocument();
  });

  it('sends a new code', async () => {
    firebase.auth.sendMfaSignInCode.mockResolvedValue();
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(firebase.auth.sendMfaSignInCode).toHaveBeenCalledWith(RECAPTCHA_CONTAINER_ID);
  });

  it('says the code is on its way, and offers no resend, until the first code has gone', () => {
    renderDialog({ sending: true });
    expect(screen.getByText('Sending a 6-digit code to your phone:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sending code...' })).toBeDisabled();
  });

  describe('resend wait', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    // The countdown ticks once a second, each tick scheduling the next.
    const waitOutCooldown = () => {
      for (let i = 0; i < RESEND_COOLDOWN_SECONDS; i += 1) {
        act(() => { jest.advanceTimersByTime(1000); });
      }
    };

    const renderSent = (props = {}) => {
      const view = render(
        <SecondFactorDialog phoneHint="+61 ••• ••• 156" sending error="" onVerified={jest.fn()} onCancel={jest.fn()} {...props} />
      );
      view.rerender(
        <SecondFactorDialog phoneHint="+61 ••• ••• 156" sending={false} error="" onVerified={jest.fn()} onCancel={jest.fn()} {...props} />
      );
      return view;
    };

    it('makes the user wait a minute after the first code before asking for another', () => {
      renderSent();
      expect(screen.getByText('We sent a 6-digit code to your phone:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Resend code in ${RESEND_COOLDOWN_SECONDS}s` })).toBeDisabled();

      waitOutCooldown();
      expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled();
    });

    it('waits again after a resend', async () => {
      firebase.auth.sendMfaSignInCode.mockResolvedValue();
      renderSent();
      waitOutCooldown();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resend code' })); });
      expect(firebase.auth.sendMfaSignInCode).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: `Resend code in ${RESEND_COOLDOWN_SECONDS}s` })).toBeDisabled();
    });
  });

  it('lets the user resend straight away when the first code failed, and clears that error once one is sent', async () => {
    firebase.auth.sendMfaSignInCode.mockResolvedValue();
    renderDialog({ error: 'Could not send the SMS code.' });
    await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(screen.queryByText('Could not send the SMS code.')).not.toBeInTheDocument());
  });

  it.each([
    ['Back to Sign In', () => userEvent.click(screen.getByRole('button', { name: 'Back to Sign In' }))],
    ['the X', () => userEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('cancels with %s', async (_, close) => {
    const { onCancel } = renderDialog();
    await close();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('is not cancelled by a tap outside it', () => {
    const { onCancel } = renderDialog();
    fireEvent.pointerDown(document.body);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cannot be cancelled while the code is being checked', async () => {
    firebase.auth.completeMfaSignIn.mockReturnValue(new Promise(() => {}));
    const { onCancel } = renderDialog();
    await enterCode('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});

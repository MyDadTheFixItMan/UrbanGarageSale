import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { firebase } from '@/api/firebaseClient';
import Layout from '@/Layout';

jest.mock('@/api/firebaseClient', () => ({
  firebase: {
    auth: {
      onAuthStateChanged: jest.fn(), me: jest.fn(), logout: jest.fn(), getCurrentUser: jest.fn(), is2FAEnabled: jest.fn(),
    },
  },
}));
jest.mock('@/components/TwoFactorSetupDialog', () => ({
  __esModule: true,
  default: ({ autoSend }) => <div role="dialog" aria-label="Turn on two-step sign-in" data-autosend={String(autoSend)} />,
}));
const twoFactorDialog = () => screen.queryByRole('dialog', { name: 'Turn on two-step sign-in' });
jest.mock('@/pages/profile/ProfileDialogs', () => ({
  CompleteProfileDialog: () => <div role="dialog" aria-label="Complete your profile" />,
}));

const COMPLETE = {
  email: 'a@b.test', role: 'user', full_name: 'Sam Lee', phone: '+61412345678',
  address: '1 Main St', suburb: 'Carlton', postcode: '3053', state: 'VIC',
};
const completeProfileDialog = () => screen.queryByRole('dialog', { name: 'Complete your profile' });

let authChanged;
const unsubscribe = jest.fn();
const renderLayout = (page = 'Home') => render(<MemoryRouter><Layout currentPageName={page}>page</Layout></MemoryRouter>);
const logOutButton = () => screen.queryAllByRole('button', { name: /log out/i });

beforeEach(() => {
  jest.clearAllMocks();
  firebase.auth.onAuthStateChanged.mockImplementation((callback) => {
    authChanged = callback;
    return unsubscribe;
  });
  firebase.auth.me.mockResolvedValue(COMPLETE);
  firebase.auth.getCurrentUser.mockReturnValue(null);
  firebase.auth.is2FAEnabled.mockResolvedValue(true);
  sessionStorage.clear();
});

describe('Layout', () => {
  it('shows the logged-in navigation as soon as someone signs up, without a reload', async () => {
    renderLayout();
    await act(() => authChanged(null));
    expect(logOutButton()).toHaveLength(0);

    await act(() => authChanged({ uid: 'new-user' }));

    expect(logOutButton().length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Profile' })[0]).toBeVisible();
  });

  it('shows Admin once an admin is signed in', async () => {
    firebase.auth.me.mockResolvedValue({ ...COMPLETE, role: 'admin' });
    renderLayout();

    await act(() => authChanged({ uid: 'admin' }));

    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Admin' })[0]).toBeVisible());
  });

  it('hides the logged-in navigation after signing out', async () => {
    renderLayout();
    await act(() => authChanged({ uid: 'user' }));

    await act(() => authChanged(null));

    expect(logOutButton()).toHaveLength(0);
  });

  it('asks someone signed in with missing profile details to complete them', async () => {
    firebase.auth.me.mockResolvedValue({ email: 'a@b.test', role: 'user', full_name: 'Sam Lee' });
    renderLayout();
    await act(() => authChanged({ uid: 'oauth-user' }));

    expect(await screen.findByRole('dialog', { name: 'Complete your profile' })).toBeInTheDocument();
  });

  it("doesn't ask on sign-in, Terms or Privacy, when the profile is complete, or when it didn't load", async () => {
    firebase.auth.me.mockResolvedValue({ email: 'a@b.test', full_name: 'Sam Lee' });
    for (const page of ['Login', 'Terms', 'Privacy']) {
      const { unmount } = renderLayout(page);
      await act(() => authChanged({ uid: 'oauth-user' }));
      expect(completeProfileDialog()).not.toBeInTheDocument();
      unmount();
    }

    firebase.auth.me.mockResolvedValue({ email: 'a@b.test', full_name: 'Sam Lee', profile_unavailable: true });
    const { unmount } = renderLayout();
    await act(() => authChanged({ uid: 'oauth-user' }));
    expect(completeProfileDialog()).not.toBeInTheDocument();
    unmount();

    firebase.auth.me.mockResolvedValue(COMPLETE);
    renderLayout();
    await act(() => authChanged({ uid: 'user' }));
    expect(completeProfileDialog()).not.toBeInTheDocument();
  });

  it('asks a complete account without 2FA to turn it on, texting the code automatically', async () => {
    firebase.auth.me.mockResolvedValue({ ...COMPLETE, id: 'u1' });
    firebase.auth.is2FAEnabled.mockResolvedValue(false);
    renderLayout();
    await act(() => authChanged({ uid: 'u1' }));

    const dialog = await screen.findByRole('dialog', { name: 'Turn on two-step sign-in' });
    expect(dialog).toHaveAttribute('data-autosend', 'true');
    expect(completeProfileDialog()).not.toBeInTheDocument();
  });

  it("doesn't text again automatically within a few minutes, such as after a refresh", async () => {
    firebase.auth.me.mockResolvedValue({ ...COMPLETE, id: 'u1' });
    firebase.auth.is2FAEnabled.mockResolvedValue(false);
    const first = renderLayout();
    await act(() => authChanged({ uid: 'u1' }));
    await screen.findByRole('dialog', { name: 'Turn on two-step sign-in' });
    first.unmount();

    renderLayout();
    await act(() => authChanged({ uid: 'u1' }));
    expect(await screen.findByRole('dialog', { name: 'Turn on two-step sign-in' })).toHaveAttribute('data-autosend', 'false');
  });

  it('asks for the profile first, then 2FA, and leaves accounts with 2FA alone', async () => {
    firebase.auth.me.mockResolvedValue({ email: 'a@b.test', full_name: 'Sam Lee', id: 'u1' });
    firebase.auth.is2FAEnabled.mockResolvedValue(false);
    const { unmount } = renderLayout();
    await act(() => authChanged({ uid: 'u1' }));
    expect(await screen.findByRole('dialog', { name: 'Complete your profile' })).toBeInTheDocument();
    expect(twoFactorDialog()).not.toBeInTheDocument();
    unmount();

    firebase.auth.me.mockResolvedValue({ ...COMPLETE, id: 'u2' });
    firebase.auth.is2FAEnabled.mockResolvedValue(true);
    renderLayout();
    await act(() => authChanged({ uid: 'u2' }));
    await waitFor(() => expect(firebase.auth.is2FAEnabled).toHaveBeenCalled());
    expect(twoFactorDialog()).not.toBeInTheDocument();
  });

  it("doesn't ask for 2FA on sign-in, Terms or Privacy", async () => {
    firebase.auth.me.mockResolvedValue({ ...COMPLETE, id: 'u1' });
    firebase.auth.is2FAEnabled.mockResolvedValue(false);
    for (const page of ['Login', 'Terms', 'Privacy']) {
      const { unmount } = renderLayout(page);
      await act(() => authChanged({ uid: 'u1' }));
      await waitFor(() => expect(firebase.auth.is2FAEnabled).toHaveBeenCalled());
      expect(twoFactorDialog()).not.toBeInTheDocument();
      unmount();
    }
  });

  it('stops listening when it is removed', () => {
    renderLayout().unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});

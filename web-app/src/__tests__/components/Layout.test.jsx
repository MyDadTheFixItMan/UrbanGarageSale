import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { firebase } from '@/api/firebaseClient';
import Layout from '@/Layout';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { auth: { onAuthStateChanged: jest.fn(), me: jest.fn(), logout: jest.fn() } },
}));

let authChanged;
const unsubscribe = jest.fn();
const renderLayout = () => render(<MemoryRouter><Layout>page</Layout></MemoryRouter>);
const logOutButton = () => screen.queryAllByRole('button', { name: /log out/i });

beforeEach(() => {
  jest.clearAllMocks();
  firebase.auth.onAuthStateChanged.mockImplementation((callback) => {
    authChanged = callback;
    return unsubscribe;
  });
  firebase.auth.me.mockResolvedValue({ email: 'a@b.test', role: 'user' });
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
    firebase.auth.me.mockResolvedValue({ email: 'a@b.test', role: 'admin' });
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

  it('stops listening when it is removed', () => {
    renderLayout().unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});

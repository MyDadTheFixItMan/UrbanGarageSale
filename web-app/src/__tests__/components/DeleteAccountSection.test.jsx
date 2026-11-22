import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { firebase } from '@/api/firebaseClient';
import DeleteAccountSection from '@/pages/profile/DeleteAccountSection';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { entities: { User: { deleteMe: jest.fn() } }, auth: { logout: jest.fn(async () => {}) } },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }) => <div>{children}</div>;
  const Dialog = ({ open, children }) => (open ? <div>{children}</div> : null);
  return { Dialog, DialogContent: Pass, DialogDescription: Pass, DialogFooter: Pass, DialogHeader: Pass, DialogTitle: Pass };
});

const openDialog = async () => {
  await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));
  return screen.getAllByRole('button', { name: /delete my account/i }).at(-1);
};

beforeEach(() => jest.clearAllMocks());

test('deleting needs DELETE typed first', async () => {
  render(<DeleteAccountSection onDeleted={jest.fn()} />);
  const confirm = await openDialog();
  expect(confirm).toBeDisabled();
  await userEvent.type(screen.getByLabelText(/type delete to confirm/i), 'delete');
  expect(confirm).toBeEnabled();
});

test('a confirmed delete calls the server and then onDeleted', async () => {
  firebase.entities.User.deleteMe.mockResolvedValue({ deleted: true });
  const onDeleted = jest.fn();
  render(<DeleteAccountSection onDeleted={onDeleted} />);
  const confirm = await openDialog();
  await userEvent.type(screen.getByLabelText(/type delete to confirm/i), 'DELETE');
  await userEvent.click(confirm);
  await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  expect(firebase.entities.User.deleteMe).toHaveBeenCalledTimes(1);
});

test('an old sign-in offers to sign in again instead', async () => {
  firebase.entities.User.deleteMe.mockRejectedValue(Object.assign(new Error('For your security, please sign out and sign in again'), { code: 'app/recent-login-required' }));
  const onDeleted = jest.fn();
  render(<DeleteAccountSection onDeleted={onDeleted} />);
  const confirm = await openDialog();
  await userEvent.type(screen.getByLabelText(/type delete to confirm/i), 'DELETE');
  await userEvent.click(confirm);
  expect(await screen.findByRole('alert')).toHaveTextContent(/sign in again/i);
  expect(screen.getByRole('button', { name: /sign out and sign in again/i })).toBeInTheDocument();
  expect(onDeleted).not.toHaveBeenCalled();
});

test('other errors are shown and the user can try again', async () => {
  firebase.entities.User.deleteMe.mockRejectedValue(new Error("Admin accounts can't be deleted here."));
  render(<DeleteAccountSection onDeleted={jest.fn()} />);
  const confirm = await openDialog();
  await userEvent.type(screen.getByLabelText(/type delete to confirm/i), 'DELETE');
  await userEvent.click(confirm);
  expect(await screen.findByRole('alert')).toHaveTextContent(/admin accounts/i);
  expect(screen.getAllByRole('button', { name: /delete my account/i }).at(-1)).toBeEnabled();
});

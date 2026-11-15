import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { auth: { signUp: jest.fn(), updateProfile: jest.fn() } },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

import SignUpForm from '@/pages/login/SignUpForm';

describe('SignUpForm', () => {
  it('shows a problem right above Create Account, where it can be seen', async () => {
    // At the top of the long form it was off-screen, so the button seemed to do nothing.
    render(<MemoryRouter><SignUpForm onExistingEmail={() => {}} onSecondFactor={() => {}} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'Create Account' });
    await userEvent.click(button);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Please fill in all fields');
    expect(alert.nextElementSibling).toBe(button);
  });

  it('offers Google sign-up only, while Facebook and Apple are off in Firebase', () => {
    render(<MemoryRouter><SignUpForm onExistingEmail={() => {}} onSecondFactor={() => {}} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Google' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Facebook' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apple' })).not.toBeInTheDocument();
  });
});

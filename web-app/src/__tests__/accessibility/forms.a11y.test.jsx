// Automated accessibility checks (axe-core) on the main forms: every input needs a label,
// ARIA must be valid, and so on. axe can't judge everything (e.g. colour contrast in jsdom),
// so this complements manual testing rather than replacing it.
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { auth: { changePassword: jest.fn(), resetPassword: jest.fn(), updateProfile: jest.fn(), signUp: jest.fn() } },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

import { BasicInfoSection, LocationSection, DateTimeSection } from '@/pages/createListing/ListingSections';
import { EMPTY_FORM } from '@/pages/createListing/listingForm';
import { ChangePasswordDialog, EditProfileDialog } from '@/pages/profile/ProfileDialogs';
import SignUpForm from '@/pages/login/SignUpForm';

expect.extend(toHaveNoViolations);

function renderWithProviders(ui) {
  const client = new QueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('form accessibility', () => {
  test('create-listing sections', async () => {
    const { container } = renderWithProviders(
      <main>
        <BasicInfoSection form={EMPTY_FORM} onChange={() => {}} />
        <LocationSection form={EMPTY_FORM} onChange={() => {}} locked={false} />
        <DateTimeSection form={EMPTY_FORM} onChange={() => {}} locked={false} />
      </main>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  test('sign-up form', async () => {
    const { container } = renderWithProviders(
      <main><SignUpForm onExistingEmail={() => {}} onSecondFactor={() => {}} /></main>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  test('profile dialogs (closed)', async () => {
    const { container } = renderWithProviders(
      <main>
        <ChangePasswordDialog email="seller@example.com" />
        <EditProfileDialog user={{ email: 'seller@example.com', full_name: 'Sam' }} onSaved={() => {}} />
      </main>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

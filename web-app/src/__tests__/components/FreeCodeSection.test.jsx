import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { firebase } from '@/api/firebaseClient';
import { toast } from 'sonner';
import FreeCodeSection from '@/pages/createListing/FreeCodeSection';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { entities: { FreeListingCode: { check: jest.fn() } } },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

async function enterCode(text) {
  await userEvent.click(screen.getByRole('button', { name: 'Have a free listing code?' }));
  await userEvent.type(screen.getByLabelText('Free listing code'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
}

beforeEach(() => jest.clearAllMocks());

describe('FreeCodeSection', () => {
  it('checks the code typed and applies it as the server writes it', async () => {
    firebase.entities.FreeListingCode.check.mockResolvedValue({ code: 'FREE-AAAA-BBBB', expiresOn: '2099-01-31' });
    const onApply = jest.fn();
    render(<FreeCodeSection applied={null} onApply={onApply} onRemove={jest.fn()} />);

    await enterCode('free aaaa bbbb');

    await waitFor(() => expect(onApply).toHaveBeenCalledWith('FREE-AAAA-BBBB'));
    expect(firebase.entities.FreeListingCode.check).toHaveBeenCalledWith('free aaaa bbbb');
  });

  it("says why a code can't be used", async () => {
    firebase.entities.FreeListingCode.check.mockRejectedValue(new Error('That code has already been used.'));
    const onApply = jest.fn();
    render(<FreeCodeSection applied={null} onApply={onApply} onRemove={jest.fn()} />);

    await enterCode('FREE-AAAA-BBBB');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That code has already been used.'));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('shows the applied code and lets the seller remove it', async () => {
    const onRemove = jest.fn();
    render(<FreeCodeSection applied="FREE-AAAA-BBBB" onApply={jest.fn()} onRemove={onRemove} />);

    expect(screen.getByText(/Code FREE-AAAA-BBBB applied/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove code' }));
    expect(onRemove).toHaveBeenCalled();
  });
});

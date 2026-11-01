import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/api/firebaseClient', () => ({ firebase: { auth: {} } }));
jest.mock('@/components/GooglePlacesAutocomplete', () => () => null);
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/utils/printGarageSaleSign', () => ({ paperSizes: { A4: { name: 'A4' }, A2: { name: 'A2' } } }));
// A real dialog stays on screen while it animates closed; keep it rendered to test that moment.
jest.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }) => <div>{children}</div>;
  return { Dialog: Pass, DialogContent: Pass, DialogDescription: Pass, DialogFooter: Pass, DialogHeader: Pass, DialogTitle: Pass, DialogTrigger: Pass };
});

import { PrintSignDialog } from '@/pages/profile/ProfileDialogs';

const listing = { id: 'sale-1' };

describe('PrintSignDialog', () => {
  it('prints the chosen listing', async () => {
    const onPrint = jest.fn();
    render(<PrintSignDialog listing={listing} onClose={() => {}} onPrint={onPrint} />);
    await userEvent.click(screen.getByRole('button', { name: 'Print Sign' }));
    expect(onPrint).toHaveBeenCalledWith(listing, 'A4');
  });

  it('prints the chosen paper size', async () => {
    const onPrint = jest.fn();
    render(<PrintSignDialog listing={listing} onClose={() => {}} onPrint={onPrint} />);
    await userEvent.click(screen.getByLabelText('A2'));
    await userEvent.click(screen.getByRole('button', { name: 'Print Sign' }));
    expect(onPrint).toHaveBeenCalledWith(listing, 'A2');
  });

  it('still has the listing if clicked again while closing', async () => {
    const onPrint = jest.fn();
    const { rerender } = render(<PrintSignDialog listing={listing} onClose={() => {}} onPrint={onPrint} />);
    rerender(<PrintSignDialog listing={null} onClose={() => {}} onPrint={onPrint} />);
    await userEvent.click(screen.getByRole('button', { name: 'Print Sign' }));
    expect(onPrint).toHaveBeenCalledWith(listing, 'A4');
  });
});

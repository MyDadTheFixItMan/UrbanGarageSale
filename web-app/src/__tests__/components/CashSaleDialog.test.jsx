import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { auth: { getCurrentUser: jest.fn() } },
}));
jest.mock('@/lib/api-base', () => ({ API_BASE_URL: 'https://api.test', apiFetch: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import { firebase } from '@/api/firebaseClient';
import { apiFetch } from '@/lib/api-base';
import { toast } from 'sonner';
import CashSaleDialog, { cashSaleProblem } from '@/pages/urbanpay/CashSaleDialog';

const garageSales = [{ id: 'sale-1', title: 'Spring clear-out' }, { id: 'sale-2', title: 'Moving sale' }];

function renderDialog(props = {}) {
  const handlers = { onOpenChange: jest.fn(), onGarageSaleChange: jest.fn(), onRecorded: jest.fn(async () => {}) };
  render(
    <CashSaleDialog
      open
      garageSales={garageSales}
      garageSalesLoading={false}
      garageSaleId="sale-1"
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

beforeEach(() => {
  jest.clearAllMocks();
  firebase.auth.getCurrentUser.mockReturnValue({ getIdToken: async () => 'id-token' });
});

describe('cashSaleProblem', () => {
  it('requires a positive amount, a description and a garage sale', () => {
    const ok = { amount: '12.50', description: 'Lamp', garageSaleId: 'sale-1' };
    expect(cashSaleProblem(ok)).toBeNull();
    expect(cashSaleProblem({ ...ok, amount: '0' })).toBe('Please enter a valid amount');
    expect(cashSaleProblem({ ...ok, amount: '-5' })).toBe('Please enter a valid amount');
    expect(cashSaleProblem({ ...ok, amount: 'abc' })).toBe('Please enter a valid amount');
    expect(cashSaleProblem({ ...ok, description: '   ' })).toBe('Please enter a description');
    expect(cashSaleProblem({ ...ok, garageSaleId: '' })).toBe('Please select a garage sale');
  });
});

describe('CashSaleDialog', () => {
  it('records the sale through the API as the signed-in seller', async () => {
    apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ amount: 12.5 }) });
    const { onOpenChange, onRecorded } = renderDialog();

    await userEvent.type(screen.getByLabelText('Amount ($)'), '12.50');
    await userEvent.type(screen.getByLabelText('Item Description'), '  Vintage lamp  ');
    await userEvent.click(screen.getByRole('button', { name: 'Record Sale' }));

    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
    const [url, options] = apiFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/urbanPayment/recordSale');
    expect(options.headers.Authorization).toBe('Bearer id-token');
    expect(JSON.parse(options.body)).toEqual({
      amount: 12.5, description: 'Vintage lamp', paymentMethod: 'cash', garageSaleId: 'sale-1',
    });
    expect(toast.success).toHaveBeenCalledWith('Cash sale recorded! $12.50');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not call the API when the form is invalid', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Item Description'), 'Lamp');
    await userEvent.click(screen.getByRole('button', { name: 'Record Sale' }));
    expect(toast.error).toHaveBeenCalledWith('Please enter a valid amount');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('shows the server error and keeps the dialog open when recording fails', async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Not your garage sale' }) });
    const { onOpenChange, onRecorded } = renderDialog();

    await userEvent.type(screen.getByLabelText('Amount ($)'), '5');
    await userEvent.type(screen.getByLabelText('Item Description'), 'Books');
    await userEvent.click(screen.getByRole('button', { name: 'Record Sale' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to record cash sale: Not your garage sale'));
    expect(onRecorded).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Record Sale' })).toBeEnabled();
  });

  it('lets the seller choose which garage sale the money belongs to', async () => {
    const { onGarageSaleChange } = renderDialog();
    await userEvent.selectOptions(screen.getByLabelText('Garage Sale'), 'sale-2');
    expect(onGarageSaleChange).toHaveBeenCalledWith('sale-2');
  });
});

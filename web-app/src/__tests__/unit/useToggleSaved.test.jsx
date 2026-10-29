import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { entities: { SavedListing: { mine: jest.fn(), create: jest.fn(), delete: jest.fn() } } },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import { firebase } from '@/api/firebaseClient';
import { toast } from 'sonner';
import { useToggleSaved } from '@/lib/useToggleSaved';

const { SavedListing } = firebase.entities;

function renderToggle() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useToggleSaved(), { wrapper }).result;
}

beforeEach(() => jest.clearAllMocks());

describe('useToggleSaved', () => {
  it('saves a listing that is not yet a favourite', async () => {
    SavedListing.mine.mockResolvedValue([]);
    const result = renderToggle();
    await act(() => result.current.mutateAsync('sale-1'));
    expect(SavedListing.create).toHaveBeenCalledWith({ garage_sale_id: 'sale-1' });
    expect(SavedListing.delete).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Saved to favourites');
  });

  it('removes a listing that is already a favourite, and says so', async () => {
    SavedListing.mine.mockResolvedValue([{ id: 'saved-9', garage_sale_id: 'sale-1' }]);
    const result = renderToggle();
    await act(() => result.current.mutateAsync('sale-1'));
    expect(SavedListing.delete).toHaveBeenCalledWith('saved-9');
    expect(SavedListing.create).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Removed from favourites');
  });

  it('shows an error when saving fails', async () => {
    SavedListing.mine.mockRejectedValue(new Error('offline'));
    const result = renderToggle();
    await act(() => result.current.mutateAsync('sale-1').catch(() => {}));
    expect(toast.error).toHaveBeenCalledWith('Failed to update favourites');
  });
});

// src/__tests__/utils/test-utils.jsx
import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider } from '@/lib/AuthContext';

/**
 * Custom render function that includes all necessary providers
 * Use this instead of render() from @testing-library/react
 */
export function renderWithProviders(ui, options = {}) {
  const Wrapper = ({ children }) => {
    return (
      <BrowserRouter future={{ v7_startTransition: true }}>
        <QueryClientProvider client={queryClientInstance}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

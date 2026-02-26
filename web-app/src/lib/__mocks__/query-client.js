// src/lib/__mocks__/query-client.js
import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

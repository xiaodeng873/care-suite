import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes — supports read-only offline browsing
      staleTime:  5 * 60 * 1000,
      gcTime:    30 * 60 * 1000,
      retry: 1,
    },
  },
});

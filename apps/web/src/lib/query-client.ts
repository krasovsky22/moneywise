import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: (failureCount, error) => {
        // Don't retry 404s
        if (error instanceof Response && error.status === 404) return false;
        return failureCount < 2;
      },
    },
  },
});

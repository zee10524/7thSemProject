import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { keys } from './api/hooks';
import { isApiError, onSessionEnded } from './api/http';
import { router } from './app/router';
import './styles/prototype/styles.css';
import './styles/prototype/demo2.css';
import './styles/app.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Client errors (4xx) will not fix themselves; network and 5xx get two retries.
      retry: (count, err) => !(isApiError(err) && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
});

onSessionEnded(() => queryClient.setQueryData(keys.me, null));

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

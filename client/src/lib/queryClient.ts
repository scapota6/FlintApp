import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

import { ensureCsrf, resetCsrf } from './csrf';

export async function apiRequest(path: string, options: RequestInit = {}) {
  const base = '';
  const url = path.startsWith('http') ? path : `${base}${path}`;

  const headers: any = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || '')) {
    const csrfToken = await ensureCsrf();
    headers['x-csrf-token'] = csrfToken; // csurf reads from this header by default
  }

  const resp = await fetch(url, {
    method: options.method || 'GET',
    headers,
    credentials: 'include', // keep cookies/session
    ...options,
  });

  // Handle CSRF mismatch - refresh token and caller can retry
  if (resp.status === 403) {
    resetCsrf();
  }

  return resp; // callers can do resp.ok / resp.json()
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

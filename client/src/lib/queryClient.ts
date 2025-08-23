import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

import { getCsrfToken, invalidateCsrf } from './csrf';
import { requestJSON } from './http';

export async function apiRequest(path: string, options: RequestInit = {}) {
  const base = '';
  const url = path.startsWith('http') ? path : `${base}${path}`;

  const headers: any = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || '')) {
    const csrfToken = await getCsrfToken();
    headers['x-csrf-token'] = csrfToken; // csurf reads from this header by default
  }

  // For GET requests or when the caller expects a Response object, return the Response
  if (!options.method || options.method === 'GET') {
    const resp = await fetch(url, {
      method: options.method || 'GET',
      headers,
      credentials: 'include', // keep cookies/session
      ...options,
    });

    // Handle CSRF mismatch - refresh token and caller can retry
    if (resp.status === 403) {
      invalidateCsrf();
    }

    return resp; // callers can do resp.ok / resp.json()
  }

  // For state-changing requests, use defensive JSON parsing
  try {
    return await requestJSON(url, {
      ...options,
      headers,
    });
  } catch (error: any) {
    // Handle CSRF token expiry
    if (error.message?.includes('403') || error.message?.includes('CSRF')) {
      invalidateCsrf();
      // Get new token and retry once
      const newToken = await getCsrfToken();
      headers['x-csrf-token'] = newToken;
      
      return await requestJSON(url, {
        ...options,
        headers,
      });
    }
    throw error;
  }
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

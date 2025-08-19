import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

let csrfToken: string | null = null;

// Fetch CSRF token explicitly
async function fetchCSRFToken() {
  try {
    const tokenResp = await fetch('/api/auth/user', {
      credentials: 'include'
    });
    const token = tokenResp.headers.get('X-CSRF-Token');
    if (token) {
      csrfToken = token;
    }
    return token;
  } catch (e) {
    console.error('Failed to fetch CSRF token:', e);
    return null;
  }
}

export async function apiRequest(path: string, options: RequestInit = {}) {
  const base = '';
  const url = path.startsWith('http') ? path : `${base}${path}`;

  // Ensure we have a CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || '')) {
    if (!csrfToken) {
      await fetchCSRFToken();
    }
  }

  const headers: any = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  // Add CSRF token for state-changing requests
  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || '')) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const resp = await fetch(url, {
    method: options.method || 'GET',
    headers,
    credentials: 'include', // keep cookies/session
    ...options,
  });

  // Update CSRF token from response if present
  const newToken = resp.headers.get('X-CSRF-Token');
  if (newToken) {
    csrfToken = newToken;
  }

  return resp; // callers can do resp.ok / resp.json()
}

// Initialize CSRF token on page load
fetchCSRFToken();

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

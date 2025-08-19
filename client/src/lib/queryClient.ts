import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Get CSRF token from cookies (double-submit pattern)
function getCSRFTokenFromCookie(): string | null {
  const name = 'flint_csrf=';
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length);
    }
  }
  return null;
}

// Fetch CSRF token from server endpoint to set cookie
async function initializeCSRFToken() {
  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include'
    });
    if (!response.ok) {
      console.error('Failed to fetch CSRF token:', response.status);
    }
    // The token is set in the cookie automatically
  } catch (e) {
    console.error('Failed to initialize CSRF token:', e);
  }
}

export async function apiRequest(path: string, options: RequestInit = {}) {
  const base = '';
  const url = path.startsWith('http') ? path : `${base}${path}`;

  const headers: any = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  // Add CSRF token for state-changing requests (double-submit cookie pattern)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || '')) {
    const csrfToken = getCSRFTokenFromCookie();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    } else {
      // If no token, fetch it first
      await initializeCSRFToken();
      const newToken = getCSRFTokenFromCookie();
      if (newToken) {
        headers['X-CSRF-Token'] = newToken;
      }
    }
  }

  const resp = await fetch(url, {
    method: options.method || 'GET',
    headers,
    credentials: 'include', // keep cookies/session
    ...options,
  });

  return resp; // callers can do resp.ok / resp.json()
}

// Initialize CSRF token on page load
initializeCSRFToken();

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

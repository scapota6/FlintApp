import { ensureCsrf, resetCsrf } from './csrf';

/**
 * Helper function for making CSRF-protected POST requests with auto-retry
 */
export async function apiPost(path: string, body: any, retryCount = 0): Promise<Response> {
  const token = await ensureCsrf();
  const resp = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token, // csurf reads from this header by default
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 403 && retryCount === 0) {
    // CSRF mismatch, refresh token and retry once
    resetCsrf();
    return apiPost(path, body, 1);
  }
  
  return resp;
}

/**
 * Helper function for making CSRF-protected PUT requests
 */
export async function apiPut(path: string, body: any) {
  const token = await ensureCsrf();
  const resp = await fetch(path, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 403) {
    resetCsrf();
  }
  
  return resp;
}

/**
 * Helper function for making CSRF-protected DELETE requests
 */
export async function apiDelete(path: string) {
  const token = await ensureCsrf();
  const resp = await fetch(path, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'x-csrf-token': token,
    },
  });

  if (resp.status === 403) {
    resetCsrf();
  }
  
  return resp;
}
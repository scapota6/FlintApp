// shared POST helper
import { ensureCsrf, resetCsrf } from '@/lib/csrf';

export async function apiPost(path: string, body: any) {
  let token = await ensureCsrf();
  let resp = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,   // csurf default header
    },
    body: JSON.stringify(body),
  });

  // If server restarted or cookie rotated, token may be stale—refresh once
  if (resp.status === 403) {
    resetCsrf();
    token = await ensureCsrf();
    resp = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify(body),
    });
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
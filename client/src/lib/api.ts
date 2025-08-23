import { getCsrfToken, invalidateCsrf } from './csrf';

export async function postJson(url: string, body: unknown) {
  let token = await getCsrfToken();

  const doFetch = async (tkn: string) => fetch(url, {
    method: 'POST',
    credentials: 'include',                 // <-- critical so the CSRF cookie & session ride
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': tkn,                  // <-- MUST match server's expected header name
    },
    body: JSON.stringify(body),
  });

  let resp = await doFetch(token);

  // auto-refresh on CSRF 403 exactly once
  if (resp.status === 403) {
    try {
      const err = await resp.json().catch(() => ({}));
      if (err?.code === 'CSRF_INVALID') {
        invalidateCsrf();
        token = await getCsrfToken();
        resp = await doFetch(token);
      }
    } catch { /* ignore */ }
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}
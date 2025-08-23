// get once per session, invalidate on 403 and refetch
export const getCsrfToken = async (): Promise<string> => {
  const r = await fetch('/api/csrf-token', { credentials: 'include' });
  const j = await r.json();
  return j.csrfToken;
};

export async function postWithCsrf(url: string, body: unknown) {
  let token = await getCsrfToken();
  const doFetch = (t: string) => fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': t },
    body: JSON.stringify(body),
  });

  let resp = await doFetch(token);
  if (resp.status === 403) {
    // refresh once
    token = await getCsrfToken();
    resp = await doFetch(token);
  }
  if (!resp.ok) throw new Error((await resp.json()).message || `HTTP ${resp.status}`);
  return resp.json();
}

// Legacy function for compatibility
export function invalidateCsrf() {
  // No-op since we no longer cache
}
let cachedCsrf: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrf) return cachedCsrf;
  const r = await fetch('/api/csrf-token', { credentials: 'include' });
  const j = await r.json();
  cachedCsrf = j.csrfToken;
  return cachedCsrf!;
}

export function invalidateCsrf() { cachedCsrf = null; }
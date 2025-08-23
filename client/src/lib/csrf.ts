let CSRF: string | null = null;
export async function getCsrf() {
  if (CSRF) return CSRF;
  const r = await fetch('/api/csrf-token', { credentials: 'include' });
  const j = await r.json();
  CSRF = j.csrfToken; 
  return CSRF!;
}
export function resetCsrf() { CSRF = null; }

// Backward compatibility exports
export const getCsrfToken = getCsrf;
export const invalidateCsrf = resetCsrf;
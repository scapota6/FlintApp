let _csrf: string | null = null;

export async function ensureCsrf(): Promise<string> {
  if (_csrf) return _csrf;
  const r = await fetch('/api/csrf-token', { credentials: 'include' });
  const j = await r.json();
  _csrf = j.csrfToken;
  return _csrf!;
}

export function resetCsrf() { 
  _csrf = null; 
}
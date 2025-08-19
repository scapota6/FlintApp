/**
 * Defensive HTTP request helper that safely handles JSON parsing
 * and provides meaningful error messages when the server returns non-JSON responses
 */

export async function requestJSON(input: RequestInfo, init?: RequestInit) {
  const resp = await fetch(input, { credentials: 'include', ...init });
  const ct = resp.headers.get('content-type') || '';

  // Read body once
  const bodyText = await resp.text();

  // Try to parse JSON only if the server says it's JSON
  const asJSON = ct.includes('application/json');
  const data = asJSON ? safeParse(bodyText) : null;

  if (!resp.ok) {
    // Build a meaningful error
    const msg =
      (data && (data.message || data.error)) ||
      `HTTP ${resp.status} ${resp.statusText || ''}`.trim();

    // Include a short snippet when server sent HTML/text
    const snippet = asJSON ? '' : ` · body: ${bodyText.slice(0, 200)}`;
    throw new Error(`${msg}${snippet}`);
  }

  if (!asJSON) {
    throw new Error(`Expected application/json but got ${ct || 'unknown'} · body: ${bodyText.slice(0, 200)}`);
  }

  return data!;
}

function safeParse(t: string) {
  try { return JSON.parse(t); } catch { return null; }
}
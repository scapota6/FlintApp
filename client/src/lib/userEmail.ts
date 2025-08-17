export function getOrPromptUserEmail(): string {
  // 1) try from localStorage
  try {
    const saved = localStorage.getItem('userEmail');
    if (saved && saved.trim()) return saved.trim().toLowerCase();
  } catch {}
  // 2) prompt once (MVP)
  // eslint-disable-next-line no-alert
  const entered = (globalThis.prompt?.('Enter your email to connect your brokerage:') || '').trim().toLowerCase();
  if (!entered) throw new Error('No email provided');
  try { localStorage.setItem('userEmail', entered); } catch {}
  return entered;
}

export function getUserEmailOptional(): string | null {
  try {
    const saved = localStorage.getItem('userEmail');
    return saved ? saved.trim().toLowerCase() : null;
  } catch { return null; }
}
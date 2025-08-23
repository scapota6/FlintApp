import { getCsrf, resetCsrf } from './csrf';

export async function postJson(url: string, body: unknown) {
  const doCall = async (token: string) => fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify(body),
  });
  let token = await getCsrf();
  let resp = await doCall(token);
  if (resp.status === 403) {
    resetCsrf(); token = await getCsrf(); resp = await doCall(token);
  }
  if (!resp.ok) throw new Error((await resp.json().catch(()=>({}))).message || `HTTP ${resp.status}`);
  return resp.json();
}
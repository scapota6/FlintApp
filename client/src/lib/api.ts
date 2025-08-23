import { postWithCsrf } from './csrf';

export async function postJson(url: string, body: unknown) {
  return postWithCsrf(url, body);
}
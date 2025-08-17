import { authApi } from '../lib/snaptrade';
import { getSnapUser, saveSnapUser } from '../store/snapUsers';

/** Ensure a SnapTrade user exists for a Flint user. userId must be your stable Flint user id (e.g., "45137738"). */
export async function ensureSnaptradeUser(userId: string) {
  const existing = await getSnapUser(userId);
  if (existing?.userSecret) return existing; // already provisioned

  // Per SnapTrade docs, registerSnapTradeUser returns { userId, userSecret }. Store the returned secret.
  const created = await authApi.registerSnapTradeUser({ userId });
  if (!created.data?.userSecret) throw new Error('SnapTrade did not return userSecret');
  const rec = { userId: created.data.userId as string, userSecret: created.data.userSecret as string };
  await saveSnapUser(rec);
  return rec;
}

/** Create Connection Portal URL (expires ~5m) */
export async function createConnectionPortal(userId: string) {
  const rec = await ensureSnaptradeUser(userId);
  const login = await authApi.loginSnapTradeUser({
    userId: rec.userId,
    userSecret: rec.userSecret,
  });
  const url = (login.data as any)?.redirectURI as string;
  if (!url) throw new Error('No Connection Portal URL returned');
  return url;
}
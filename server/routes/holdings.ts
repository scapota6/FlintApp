import { Router } from "express";
import { accountsApi, portfoliosApi } from "../lib/snaptrade";
import { getSnapUserByEmail } from "../store/snapUserStore";

const r = Router();

function pickEmail(req: any): string | null {
  const e1 = req.user?.email, e2 = req.headers["x-user-email"], e3 = req.query.userEmail;
  const email = (e1 || e2 || e3 || "").toString().trim().toLowerCase();
  return email || null;
}

r.get("/", async (req, res) => {
  try {
    const userId = pickEmail(req);
    if (!userId) return res.status(401).send("No user");

    const rec = await getSnapUserByEmail(userId);
    const userSecret = rec?.snaptrade_user_secret;
    if (!userSecret) return res.status(428).json({ // 428 Precondition Required
      code: "SNAPTRADE_NOT_REGISTERED",
      message: "SnapTrade not registered for user",
    });

    try {
      const accounts = await accountsApi.listUserAccounts({ userId, userSecret });
      // For now, just return accounts data - positions can be added when method name is confirmed
      return res.json({ accounts: accounts.data || [], positions: [] });
    } catch (e: any) {
      const body = e?.responseBody || {};
      const code = body?.code || body?.status_code;

      // SnapTrade: 401 / 1083 -> invalid userId/userSecret pair (mismatch with what SnapTrade already has)
      if (e?.status === 401 && String(code) === "1083") {
        return res.status(409).json({
          code: "SNAPTRADE_USER_MISMATCH",
          message: "Your SnapTrade user on the provider doesn't match our stored secret. Reconnect with a fresh alias or reset the user.",
        });
      }
      throw e;
    }
  } catch (err: any) {
    console.error("Error fetching holdings:", err?.responseBody || err?.message || err);
    return res.status(500).json({ message: "Failed to fetch holdings" });
  }
});

export default r;
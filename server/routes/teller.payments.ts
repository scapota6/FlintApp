import { Router } from "express";
import { ensureUser } from "../middleware/auth";
import { tellerForUser } from "../teller/client";

const r = Router();

/**
 * GET /api/teller/payments/capability?from=acc_xxx&to=acc_yyy
 * Returns if we should show the "Pay Card" button.
 */
r.get("/api/teller/payments/capability", ensureUser, async (req, res) => {
  try {
    const { from, to } = req.query as any;
    if (!from || !to) return res.json({ canPay: false, reason: "Missing from/to" });

    const teller = await tellerForUser(req.user.id);
    const fromAcc = await teller.accounts.get(from);
    const toAcc = await teller.accounts.get(to);

    const fromIsDDA = ["checking","savings"].includes((fromAcc.subtype||"").toLowerCase());
    const toIsCard  = (toAcc.subtype||"").toLowerCase() === "credit_card";
    if (!fromIsDDA || !toIsCard) return res.json({ canPay: false, reason: "Funding must be checking/savings; destination must be credit card" });

    // If your SDK has OPTIONS /accounts/:id/payments or a metadata call, use it here.
    // In sandbox, many issuers will NOT support card pay-ins — return canPay:false.
    return res.json({ canPay: false, reason: "Issuer not supported in sandbox" });
  } catch (e: any) {
    return res.json({ canPay: false, reason: e?.message || "Unknown" });
  }
});

export default r;
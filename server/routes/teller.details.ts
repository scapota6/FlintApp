import { Router } from "express";
import { ensureUser } from "../middleware/auth";
import { tellerForUser } from "../teller/client"; // your Teller client wrapper
import { getTellerAccountIdForFlintId } from "../storage";

const r = Router();

/**
 * GET /api/teller/accounts/:id/details
 * :id must be Teller account id (opaque string). If you only have Flint id, map it first.
 */
r.get("/api/teller/accounts/:id/details", ensureUser, async (req, res) => {
  try {
    const tellerAccId = req.params.id;
    const teller = await tellerForUser(req.user.id);

    const account = await teller.accounts.get(tellerAccId);
    const balances = await teller.accounts.balances(tellerAccId).catch(() => ({}));
    const since = new Date(); since.setMonth(since.getMonth() - 3);
    const transactions = await teller.transactions.list(tellerAccId, { from: since.toISOString().slice(0,10) }).catch(() => []);
    const statements = await teller.statements?.list?.(tellerAccId).catch(() => []) || [];

    // Some institutions expose card-specific fields via details or a card meta endpoint:
    const isCard = (account.subtype || "").toLowerCase() === "credit_card";
    const cardMeta = isCard ? await teller.creditCards?.get?.(tellerAccId).catch(() => null) : null;

    return res.json({
      accountOverview: {
        tellerAccountId: account.id,
        institution: account.institution?.name,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        currency: account.currency,
        mask: account.mask,
      },
      // CREDIT CARD: show due dates & payments first
      paymentsAndDueDates: isCard ? {
        paymentDueDate: cardMeta?.payment_due_date ?? balances?.payment_due_date ?? null,
        minimumPaymentDue: cardMeta?.minimum_payment_due ?? balances?.minimum_payment_due ?? null,
        statementBalance: balances?.statement ?? null,
        lastPaymentAmount: cardMeta?.last_payment_amount ?? null,
        lastPaymentDate: cardMeta?.last_payment_date ?? null,
      } : null,
      creditAvailability: isCard ? {
        availableCredit: balances?.available_credit ?? null,
        creditLimit: balances?.credit_limit ?? null,
        currentBalance: balances?.current ?? null,
      } : null,
      balances: !isCard ? {
        available: balances?.available ?? null,
        current: balances?.current ?? null,
        ledger: balances?.ledger ?? null,
        pending: balances?.pending ?? null,
      } : null,
      aprAndFees: isCard ? {
        aprPurchase: cardMeta?.apr_purchase ?? null,
        aprCashAdvance: cardMeta?.apr_cash_advance ?? null,
        aprBalanceTransfer: cardMeta?.apr_balance_transfer ?? null,
        annualFee: cardMeta?.annual_fee ?? null,
        lateFee: cardMeta?.late_fee ?? null,
      } : null,
      transactions: transactions.map((t: any) => ({
        id: t.id, date: t.date, status: t.status,
        description: t.description, merchant: t.merchant?.name || null,
        amount: t.amount, currency: t.currency || account.currency,
      })),
      statements: statements.map((s: any) => ({
        id: s.id, periodStart: s.period_start, periodEnd: s.period_end,
        statementBalance: s.balance, dueDate: s.due_date ?? null,
        downloadAvailable: !!s.download_url,
      })),
      paymentsCapability: false, // set via separate capability check (see below)
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Failed to load Teller account details", error: e?.message || e });
  }
});

/**
 * GET /api/teller/accounts/flint/:id/details
 * :id is Flint internal account ID, will be mapped to Teller account ID
 */
r.get("/api/teller/accounts/flint/:id/details", ensureUser, async (req, res) => {
  try {
    const flintAccountId = parseInt(req.params.id);
    const tellerAccountId = await getTellerAccountIdForFlintId(flintAccountId);
    
    if (!tellerAccountId) {
      return res.status(404).json({ message: 'Account not found or not linked to Teller' });
    }

    // Redirect to the main details endpoint with Teller ID
    req.params.id = tellerAccountId;
    return r.handle(req, res);
  } catch (error) {
    console.error('[Teller] Flint account mapping error:', error);
    res.status(500).json({ 
      message: 'Failed to map account ID',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default r;
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

    // Credit card specific details
    const details = {
      account,
      balances,
      transactions: transactions.slice(0, 50), // Latest 50 transactions
      statements: statements.slice(0, 12), // Latest 12 statements
      
      // Credit card specific fields
      creditInfo: account.type === 'credit' ? {
        creditLimit: balances.available ? parseFloat(balances.available) + parseFloat(balances.ledger || '0') : null,
        availableCredit: balances.available ? parseFloat(balances.available) : null,
        currentBalance: balances.ledger ? parseFloat(balances.ledger) : null,
        minimumPayment: account.meta?.minimum_payment || null,
        dueDate: account.meta?.payment_due_date || null,
        lastPaymentDate: account.meta?.last_payment_date || null,
        lastPaymentAmount: account.meta?.last_payment_amount || null,
        apr: account.meta?.apr || null,
      } : null,

      // Account metadata
      accountInfo: {
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        institutionName: account.institution?.name || 'Unknown',
        accountNumber: account.last_four ? `****${account.last_four}` : account.number,
        currency: account.currency || 'USD',
        status: account.status || 'active',
      }
    };

    res.json(details);
  } catch (error) {
    console.error('[Teller] Account details error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch account details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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
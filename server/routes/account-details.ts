import { Router } from 'express';
import { getSnapUser } from '../store/snapUsers';
import { listAccounts, getPositions, getAccountBalances, listOpenOrders, listOrderHistory, listActivities } from '../lib/snaptrade';

const r = Router();
const pickId = (req: any) => (req.user?.id || req.headers['x-user-id'] || req.query.userId || '').toString().trim();

/**
 * GET /api/accounts/:accountId/details
 * Headers: x-user-id: <flintUserId>
 * 
 * Aggregates comprehensive account data from SnapTrade:
 * - Account info and balances
 * - Current positions/holdings
 * - Open orders
 * - Order history
 * - Activities/transactions
 */
r.get('/accounts/:accountId/details', async (req, res) => {
  try {
    const userId = pickId(req);
    if (!userId) return res.status(401).json({ message: 'No userId' });
    const accountId = String(req.params.accountId);

    const rec = await getSnapUser(userId);
    if (!rec?.userSecret) {
      return res.status(428).json({ 
        code: 'SNAPTRADE_NOT_REGISTERED', 
        message: 'No SnapTrade user for this userId' 
      });
    }

    // Verify the account belongs to this user (defense in depth)
    const accounts = await listAccounts(rec.userId, rec.userSecret);
    const account = accounts.find((a: any) => String(a.id) === String(accountId));
    if (!account) {
      return res.status(404).json({ message: 'Account not found for user' });
    }

    // Fetch all account data in parallel for better performance
    const [
      balances,
      positions,
      openOrders,
      orderHistory,
      activities
    ] = await Promise.allSettled([
      getAccountBalances(rec.userId, rec.userSecret, accountId),
      getPositions(rec.userId, rec.userSecret, accountId),
      listOpenOrders(rec.userId, rec.userSecret, accountId),
      listOrderHistory(rec.userId, rec.userSecret, accountId),
      listActivities(rec.userId, rec.userSecret, accountId)
    ]);

    // Helper function to safely extract data or return fallback
    const safeData = (result: PromiseSettledResult<any>, fallback: any = null) => {
      if (result.status === 'fulfilled') {
        return result.value?.data || result.value || fallback;
      } else {
        console.error('SnapTrade API error:', result.reason?.message || result.reason);
        return fallback;
      }
    };

    // Build comprehensive response
    const response = {
      account: {
        id: account.id,
        name: account.name,
        number: account.number,
        institution: account.institution_name,
        type: account.meta?.type || account.raw_type,
        status: account.meta?.status || 'ACTIVE',
        balance: account.balance
      },
      balances: safeData(balances, {}),
      positions: safeData(positions, []),
      orders: {
        open: safeData(openOrders, []),
        history: safeData(orderHistory, [])
      },
      activities: safeData(activities, []),
      metadata: {
        fetched_at: new Date().toISOString(),
        last_sync: account.sync_status,
        cash_restrictions: account.cash_restrictions || []
      }
    };

    res.json(response);

  } catch (error: any) {
    console.error('Account details error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch account details',
      error: error.message 
    });
  }
});

export default r;
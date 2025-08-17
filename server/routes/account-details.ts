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

    // Parallel fetches with error handling
    const [balances, positions, openOrders, orderHistory, activities] = await Promise.all([
      getAccountBalances(rec.userId, rec.userSecret, accountId).catch(() => null),
      getPositions(rec.userId, rec.userSecret, accountId).catch(() => []),
      listOpenOrders(rec.userId, rec.userSecret, accountId).catch(() => []),
      listOrderHistory(rec.userId, rec.userSecret, accountId).catch(() => []),
      listActivities(rec.userId, rec.userSecret, accountId).catch(() => []),
    ]);



    // Shape response for UI
    const response = {
      accountInformation: {
        id: account.id,
        name: account.name,
        number: account.number,
        brokerage: account.institution_name || '—',
        type: account.meta?.type || account.raw_type || '—',
        status: account.meta?.status || 'ACTIVE',
        currency: account.balance?.total?.currency || 'USD',
        balancesOverview: {
          cash: balances?.cash || balances?.cashBalance || null,
          equity: balances?.equity || balances?.accountValue || account.balance?.total?.amount || null,
          buyingPower: balances?.buyingPower || balances?.marginBuyingPower || null,
        },
      },
      balancesAndHoldings: {
        balances: {
          cashAvailableToTrade: balances?.cashAvailableToTrade ?? balances?.cash ?? null,
          totalEquityValue: balances?.equity ?? balances?.accountValue ?? account.balance?.total?.amount ?? null,
          buyingPowerOrMargin: balances?.buyingPower ?? balances?.marginBuyingPower ?? null,
        },
        holdings: Array.isArray(positions) && positions.length > 0 ? 
          positions.flatMap(accountData => {
            const accountPositions = accountData.positions || [];
            
            return accountPositions.map(p => {
              const symbol = p.symbol?.symbol?.symbol || 'UNKNOWN';
              const quantity = parseFloat(p.units || '0');
              
              return {
                symbol,
                name: p.symbol?.symbol?.description || symbol,
                quantity,
                costBasis: parseFloat(p.average_purchase_price || '0'),
                marketValue: quantity * parseFloat(p.price || '0'),
                currentPrice: parseFloat(p.price || '0'),
                unrealized: parseFloat(p.open_pnl || '0'),
              };
            }).filter(h => h.quantity > 0);
          }) : [],
      },
      positionsAndOrders: {
        activePositions: Array.isArray(positions) ? positions.filter((p: any) => (p.quantity ?? 0) > 0) : [],
        pendingOrders: Array.isArray(openOrders) ? openOrders : [],
        orderHistory: Array.isArray(orderHistory) ? orderHistory : [],
      },
      tradingActions: {
        canPlaceOrders: true,
        canCancelOrders: true,
        canGetConfirmations: true,
      },
      activityAndTransactions: Array.isArray(activities) ? activities.map((a: any) => ({
        type: a.type || a.activityType || '—',
        symbol: a.symbol || a.ticker || a.security?.symbol || undefined,
        amount: a.amount ?? a.value ?? undefined,
        quantity: a.quantity ?? a.shares ?? undefined,
        timestamp: a.timestamp || a.time || a.date || null,
        description: a.description || a.note || '',
      })) : [],
      metadata: {
        fetched_at: new Date().toISOString(),
        last_sync: account.sync_status,
        cash_restrictions: account.cash_restrictions || [],
        account_created: account.created_date,
      }
    };

    return res.json(response);
  } catch (e: any) {
    console.error('Account details error:', e?.responseBody || e?.message || e);
    return res.status(500).json({ message: 'Failed to load account details' });
  }
});

export default r;
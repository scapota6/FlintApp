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
        holdings: Array.isArray(positions) ? positions.map((p: any) => ({
          symbol: p.symbol?.symbol || p.symbol || p.ticker || p.instrument?.symbol || '—',
          name: p.symbol?.name || p.name || '—',
          quantity: p.quantity ?? p.qty ?? 0,
          costBasis: p.average_purchase_price ?? p.costBasis ?? p.avgPrice ?? null,
          marketValue: p.market_value ?? p.marketValue ?? p.value ?? null,
          currentPrice: p.current_price ?? p.price ?? null,
          unrealized: p.unrealized_pl ?? p.unrealizedPL ?? p.unrealizedGainLoss ?? null,
        })) : [],
      },
      orders: {
        open: Array.isArray(openOrders) ? openOrders.map((o: any) => ({
          id: o.id,
          symbol: o.symbol?.symbol || o.symbol || '—',
          quantity: o.quantity ?? 0,
          action: o.action || o.side || '—',
          orderType: o.order_type || o.type || '—',
          price: o.price ?? null,
          timeInForce: o.time_in_force || o.tif || '—',
          status: o.status || '—',
          createdAt: o.created_at || o.timestamp || null,
        })) : [],
        history: Array.isArray(orderHistory) ? orderHistory.slice(0, 50).map((o: any) => ({
          id: o.id,
          symbol: o.symbol?.symbol || o.symbol || '—',
          quantity: o.quantity ?? 0,
          action: o.action || o.side || '—',
          orderType: o.order_type || o.type || '—',
          price: o.price ?? null,
          executedAt: o.executed_at || o.filled_at || o.timestamp || null,
          status: o.status || '—',
        })) : [],
      },
      activities: Array.isArray(activities) ? activities.slice(0, 100).map((a: any) => ({
        id: a.id,
        type: a.type || a.activity_type || '—',
        symbol: a.symbol?.symbol || a.symbol || null,
        description: a.description || `${a.type || 'Activity'} ${a.symbol?.symbol || ''}`.trim(),
        quantity: a.quantity ?? null,
        price: a.price ?? null,
        fee: a.fee ?? null,
        netAmount: a.net_amount ?? a.amount ?? null,
        settlementDate: a.settlement_date || a.date || a.timestamp || null,
      })) : [],
      metadata: {
        fetched_at: new Date().toISOString(),
        last_sync: account.sync_status,
        cash_restrictions: account.cash_restrictions || [],
        account_created: account.created_date,
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
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
    
    // console.log('DEBUG: Activities response length:', activities?.length || 0);

    // Extract balance data from positions response (balances API failed, but balance data is in positions)
    const balanceArray = positions?.[0]?.balances || [];
    const balanceData = Array.isArray(balanceArray) && balanceArray.length > 0 ? balanceArray[0] : null;

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
          cash: balanceData?.cash || null,
          equity: balanceData?.equity || account.balance?.total?.amount || null,
          buyingPower: balanceData?.buying_power || null,
        },
      },
      balancesAndHoldings: {
        balances: {
          cashAvailableToTrade: balanceData?.cash ?? null,
          totalEquityValue: balanceData?.equity ?? account.balance?.total?.amount ?? null,
          buyingPowerOrMargin: balanceData?.buying_power ?? null,
        },
        holdings: Array.isArray(positions) && positions.length > 0 ? 
          positions.flatMap(accountData => {
            const accountPositions = accountData.positions || [];
            
            return accountPositions.map((p: any) => {
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
            }).filter((h: any) => h.quantity > 0);
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
      activityAndTransactions: (() => {
        // Combine activities and order history for a comprehensive view
        const activityList = [];
        
        // Add activities if any
        if (Array.isArray(activities) && activities.length > 0) {
          activities.forEach((a: any) => {
            const symbol = a.symbol?.symbol || a.symbol?.raw_symbol || a.symbol?.ticker || undefined;
            const timestamp = a.settlement_date || a.trade_date || a.timestamp || a.time || a.date || null;
            
            activityList.push({
              type: a.type || a.activityType || 'Activity',
              symbol: symbol,
              amount: a.amount ?? a.value ?? undefined,
              quantity: a.quantity ?? a.shares ?? a.units ?? undefined,
              timestamp: timestamp,
              description: a.description || a.note || `${a.type || 'Activity'} for ${symbol || 'account'}`,
            });
          });
        }
        
        // Add recent order history as activities
        if (Array.isArray(orderHistory) && orderHistory.length > 0) {
          // Take last 15 orders and format as activities
          orderHistory.slice(-15).forEach((order: any) => {
            const symbol = order.symbol || 
                          order.universal_symbol?.symbol || 
                          order.option_symbol?.underlying_symbol?.symbol ||
                          order.option_symbol?.ticker ||
                          'Unknown';
            
            const action = order.action || 'Trade';
            const price = order.execution_price || order.limit_price || 0;
            const qty = parseFloat(order.filled_quantity || order.total_quantity || '0');
            const amount = price * qty;
            
            activityList.push({
              type: `${action.replace('_', ' ')} Order`,
              symbol: symbol,
              amount: amount > 0 ? amount : undefined,
              quantity: qty > 0 ? qty : undefined,
              timestamp: order.time_executed || order.time_updated || order.time_placed || null,
              description: `${action} ${qty} shares of ${symbol} at $${price}`,
            });
          });
        }
        
        // Sort by timestamp (newest first) and limit to 15 most recent
        return activityList
          .filter(a => a.timestamp) // Only include items with timestamps
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 15);
      })(),
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
import { Router } from 'express';
import { db } from '../db';
import { users, connectedAccounts } from '@/shared/schema';
import { eq } from 'drizzle-orm';
import { Snaptrade } from 'snaptrade-typescript-sdk';

const router = Router();

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Initialize SnapTrade client
const getSnapTradeClient = () => {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CLIENT_SECRET;

  if (!clientId || !consumerKey) {
    throw new Error('Missing SnapTrade credentials');
  }

  return new Snaptrade({
    clientId,
    consumerKey,
  });
};

// Get all transactions across all accounts
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user[0]) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { startDate, endDate, accountId, type } = req.query;
    const transactions: any[] = [];

    // Fetch SnapTrade transactions (brokerage)
    if (process.env.SNAPTRADE_CLIENT_ID && user[0].snaptradeUserSecret) {
      try {
        const snaptrade = getSnapTradeClient();
        
        // Get all connected SnapTrade accounts
        const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
          userId: user[0].email,
          userSecret: user[0].snaptradeUserSecret,
        });

        const accounts = accountsResponse.data || [];
        
        // Fetch activities for each account
        for (const account of accounts) {
          // Skip if specific accountId is requested and doesn't match
          if (accountId && account.id !== accountId) continue;

          try {
            const activitiesResponse = await snaptrade.transactionsAndReporting.getActivities({
              userId: user[0].email,
              userSecret: user[0].snaptradeUserSecret,
              accountId: account.id,
              startDate: startDate as string,
              endDate: endDate as string,
            });

            const activities = activitiesResponse.data || [];
            
            // Transform SnapTrade activities to unified format
            activities.forEach((activity: any) => {
              // Filter by type if specified
              if (type && !activity.type?.toLowerCase().includes(type.toString().toLowerCase())) {
                return;
              }

              transactions.push({
                id: activity.id || `snaptrade-${Date.now()}-${Math.random()}`,
                accountId: account.id,
                accountName: account.name,
                accountType: 'brokerage',
                provider: 'snaptrade',
                date: activity.trade_date || activity.settlement_date,
                type: activity.type || 'trade',
                description: activity.description || `${activity.action} ${activity.symbol?.symbol || ''}`,
                symbol: activity.symbol?.symbol,
                quantity: activity.units,
                price: activity.price,
                amount: activity.net_amount || (activity.units * activity.price),
                fee: activity.fee,
                currency: activity.currency?.code || 'USD',
                status: activity.status || 'completed',
                rawData: activity,
              });
            });
          } catch (error) {
            console.error(`Error fetching activities for SnapTrade account ${account.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Error fetching SnapTrade transactions:', error);
      }
    }

    // Fetch Teller transactions (banking)
    if (process.env.TELLER_APPLICATION_ID) {
      try {
        // Get connected Teller accounts from database
        const tellerAccounts = await db
          .select()
          .from(connectedAccounts)
          .where(eq(connectedAccounts.userId, userId))
          .where(eq(connectedAccounts.provider, 'teller'));

        for (const tellerAccount of tellerAccounts) {
          // Skip if specific accountId is requested and doesn't match
          if (accountId && tellerAccount.id.toString() !== accountId) continue;

          try {
            const tellerResponse = await fetch(
              `https://api.teller.io/accounts/${tellerAccount.externalAccountId}/transactions`,
              {
                headers: {
                  'Authorization': `Bearer ${tellerAccount.accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (tellerResponse.ok) {
              const tellerTransactions = await tellerResponse.json();
              
              // Transform Teller transactions to unified format
              tellerTransactions.forEach((transaction: any) => {
                // Filter by date range
                const transactionDate = new Date(transaction.date);
                if (startDate && transactionDate < new Date(startDate as string)) return;
                if (endDate && transactionDate > new Date(endDate as string)) return;
                
                // Filter by type if specified
                if (type && type !== 'bank') return;

                transactions.push({
                  id: transaction.id,
                  accountId: tellerAccount.id.toString(),
                  accountName: tellerAccount.accountName,
                  accountType: 'bank',
                  provider: 'teller',
                  date: transaction.date,
                  type: transaction.type || 'bank_transaction',
                  description: transaction.description,
                  amount: parseFloat(transaction.amount),
                  currency: 'USD',
                  status: transaction.status || 'posted',
                  category: transaction.category,
                  merchant: transaction.merchant_name,
                  rawData: transaction,
                });
              });
            }
          } catch (error) {
            console.error(`Error fetching Teller transactions for account ${tellerAccount.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Error fetching Teller transactions:', error);
      }
    }

    // Sort transactions by date (newest first)
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      transactions,
      total: transactions.length,
      filters: {
        startDate,
        endDate,
        accountId,
        type,
      },
    });

  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      message: 'Failed to fetch transactions', 
      error: error.message 
    });
  }
});

// Get transactions for a specific account
router.get('/transactions/:accountId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { accountId } = req.params;
    const { startDate, endDate, type } = req.query;
    
    // Use the main transactions endpoint with accountId filter
    req.query.accountId = accountId;
    return router.handle(req, res);
    
  } catch (error: any) {
    console.error('Error fetching account transactions:', error);
    res.status(500).json({ 
      message: 'Failed to fetch account transactions', 
      error: error.message 
    });
  }
});

export default router;
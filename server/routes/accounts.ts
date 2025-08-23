/**
 * Accounts Management Routes
 * Handles brokerage and bank account data retrieval
 */

import { Router } from "express";
import { authApi, accountsApi } from "../lib/snaptrade";
import crypto from "crypto";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { logger } from "@shared/logger";

const router = Router();

/**
 * GET /api/brokerages
 * Returns all brokerage accounts for the authenticated user
 */
router.get("/brokerages", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Get connected brokerage accounts from database
    const dbAccounts = await storage.getConnectedAccountsByProvider(userId, 'snaptrade');
    
    if (!dbAccounts || dbAccounts.length === 0) {
      return res.json({ accounts: [] });
    }
    
    // Get SnapTrade user credentials for connectivity validation
    const snaptradeUser = await storage.getSnapTradeUser(userId);
    
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser?.userSecret) {
      // No SnapTrade credentials - mark all SnapTrade accounts as inactive
      console.log('[SnapTrade Connectivity] No user credentials found, marking all accounts inactive');
      for (const account of dbAccounts) {
        await storage.updateConnectedAccountActive(account.id, false);
      }
      return res.json({ accounts: [] });
    }
    
    // Test connectivity and filter accessible accounts
    const validAccounts = [];
    const invalidAccountIds = [];
    
    try {
      // Test connectivity by fetching account list from SnapTrade
      const snaptradeAccounts = await accountsApi.listUserAccounts({
        userId: snaptradeUser.snaptradeUserId,
        userSecret: snaptradeUser.userSecret
      });
      
      // Create a map of accessible account IDs from SnapTrade
      const accessibleAccountIds = new Set(snaptradeAccounts.map(acc => acc.id));
      
      for (const dbAccount of dbAccounts) {
        if (!dbAccount.externalAccountId) {
          console.log(`[SnapTrade Connectivity] Account ${dbAccount.id} missing externalAccountId, marking inactive`);
          invalidAccountIds.push(dbAccount.id);
          continue;
        }
        
        if (accessibleAccountIds.has(dbAccount.externalAccountId)) {
          // Account is accessible via SnapTrade API
          const snapAccount = snaptradeAccounts.find(acc => acc.id === dbAccount.externalAccountId);
          if (snapAccount) {
            // Update balance with fresh data
            await storage.updateAccountBalance(
              dbAccount.id,
              String(snapAccount.balance?.total?.amount || 0)
            );
            
            validAccounts.push({
              id: dbAccount.id,
              name: dbAccount.accountName,
              currency: dbAccount.currency || 'USD',
              balance: parseFloat(String(snapAccount.balance?.total?.amount || 0)),
              buyingPower: parseFloat(String(snapAccount.balance?.total?.amount || 0)) * 0.5,
              lastSync: new Date()
            });
            console.log(`[SnapTrade Connectivity] Account ${dbAccount.id} (${dbAccount.externalAccountId}) is accessible`);
          }
        } else {
          // Account not found in SnapTrade API response - mark as inactive
          console.log(`[SnapTrade Connectivity] Account ${dbAccount.id} (${dbAccount.externalAccountId}) not accessible, marking inactive`);
          invalidAccountIds.push(dbAccount.id);
        }
      }
      
    } catch (error: any) {
      // SnapTrade API error - could be authentication issue
      console.log('[SnapTrade Connectivity] API call failed:', error.message);
      if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('authentication')) {
        // Authentication error - mark all accounts as inactive
        for (const account of dbAccounts) {
          invalidAccountIds.push(account.id);
        }
      }
      // For other errors, don't mark accounts as inactive (might be temporary)
    }
    
    // Mark accounts with invalid credentials as inactive in database
    for (const accountId of invalidAccountIds) {
      try {
        await storage.updateConnectedAccountActive(accountId, false);
        console.log(`[SnapTrade Connectivity] Marked account ${accountId} as inactive in database`);
      } catch (updateError: any) {
        console.error(`[SnapTrade Connectivity] Failed to mark account ${accountId} as inactive:`, updateError.message);
      }
    }
    
    logger.info("SnapTrade accounts retrieved with connectivity validation", { 
      userId, 
      totalInDb: dbAccounts.length,
      validAccounts: validAccounts.length,
      invalidAccounts: invalidAccountIds.length
    });
    
    res.json({ accounts: validAccounts });
    
  } catch (error) {
    logger.error("Error fetching brokerage accounts", { error });
    res.status(500).json({ 
      message: "Failed to fetch brokerage accounts",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/brokerages/:id/holdings
 * Returns holdings for a specific brokerage account
 */
router.get("/brokerages/:id/holdings", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const accountId = parseInt(req.params.id);
    
    // Verify account ownership
    const account = await storage.getConnectedAccount(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ message: "Account not found" });
    }
    
    let holdings: any[] = [];
    
    // Fetch from SnapTrade if available
    if (snaptradeClient && account.provider === 'snaptrade') {
      const snaptradeUser = await storage.getSnapTradeUser(userId);
      
      if (snaptradeUser?.snaptradeUserId && snaptradeUser?.userSecret) {
        try {
          const { data: positions } = await snaptradeClient.accountInformation.getUserAccountPositions({
            userId: snaptradeUser.snaptradeUserId,
            userSecret: snaptradeUser.userSecret,
            accountId: account.externalAccountId!
          });
          
          holdings = positions.map(position => ({
            symbol: position.symbol?.symbol || 'UNKNOWN',
            qty: position.units || 0,
            avgPrice: position.average_purchase_price || 0,
            marketPrice: position.price || 0,
            value: (position.units || 0) * (position.price || 0),
            dayPnl: 0, // SnapTrade doesn't provide day P&L directly
            totalPnl: ((position.price || 0) - (position.average_purchase_price || 0)) * (position.units || 0)
          }));
        } catch (error) {
          logger.error("Failed to fetch SnapTrade positions", { error });
        }
      }
    }
    
    // If no live data, return cached holdings from database
    if (holdings.length === 0) {
      const dbHoldings = await storage.getHoldingsByAccount(accountId);
      holdings = dbHoldings.map(h => ({
        symbol: h.symbol,
        qty: parseFloat(h.quantity),
        avgPrice: parseFloat(h.averagePrice),
        marketPrice: parseFloat(h.currentPrice),
        value: parseFloat(h.marketValue),
        dayPnl: 0,
        totalPnl: parseFloat(h.gainLoss)
      }));
    }
    
    res.json({ holdings });
    
  } catch (error) {
    logger.error("Error fetching holdings", { error });
    res.status(500).json({ 
      message: "Failed to fetch holdings",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/brokerages/:id/transactions
 * Returns transactions for a specific brokerage account
 */
router.get("/brokerages/:id/transactions", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const accountId = parseInt(req.params.id);
    
    // Verify account ownership
    const account = await storage.getConnectedAccount(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ message: "Account not found" });
    }
    
    let transactions: any[] = [];
    
    // Fetch from SnapTrade if available
    if (snaptradeClient && account.provider === 'snaptrade') {
      const snaptradeUser = await storage.getSnapTradeUser(userId);
      
      if (snaptradeUser?.snaptradeUserId && snaptradeUser?.userSecret) {
        try {
          const { data: activities } = await snaptradeClient.transactionsAndReporting.getActivities({
            userId: snaptradeUser.snaptradeUserId,
            userSecret: snaptradeUser.userSecret,
            accounts: account.externalAccountId!
          });
          
          transactions = activities.map(activity => ({
            id: activity.id || crypto.randomUUID(),
            type: activity.type || 'trade',
            symbol: activity.symbol,
            qty: activity.units,
            price: activity.price,
            amount: activity.amount,
            date: activity.trade_date || new Date().toISOString()
          }));
        } catch (error) {
          logger.error("Failed to fetch SnapTrade activities", { error });
        }
      }
    }
    
    // If no live data, return recent trades from database
    if (transactions.length === 0) {
      const trades = await storage.getTrades(userId, 100);
      transactions = trades
        .filter(t => t.accountId === String(accountId))
        .map(t => ({
          id: t.id,
          type: t.side,
          symbol: t.symbol,
          qty: parseFloat(t.quantity),
          price: parseFloat(t.price),
          amount: parseFloat(t.totalAmount),
          date: t.executedAt || t.createdAt
        }));
    }
    
    res.json({ transactions });
    
  } catch (error) {
    logger.error("Error fetching transactions", { error });
    res.status(500).json({ 
      message: "Failed to fetch transactions",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/banks
 * Returns all bank and card accounts for the authenticated user
 */
router.get("/banks", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Get connected bank/card accounts from database
    const accounts = await storage.getConnectedAccounts(userId);
    const bankAccounts = accounts.filter(acc => 
      acc.accountType === 'bank' || acc.accountType === 'card'
    );
    
    // If Teller is configured, fetch fresh data
    if (process.env.TELLER_APPLICATION_ID) {
      for (const account of bankAccounts) {
        if (account.provider === 'teller' && account.accessToken) {
          try {
            // Fetch account details from Teller
            const response = await fetch(`https://api.teller.io/accounts/${account.externalAccountId}`, {
              headers: {
                'Authorization': `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`,
              },
            });
            
            if (response.ok) {
              const tellerAccount = await response.json();
              
              // Update balance in database - handle credit cards differently
              let balanceToStore;
              if (tellerAccount.type === 'credit') {
                // For credit cards, show the debt (positive amount owed)
                balanceToStore = tellerAccount.balance?.current ? Math.abs(tellerAccount.balance.current) : 0;
              } else {
                // For bank accounts, show available balance
                balanceToStore = tellerAccount.balance?.available || 0;
              }
              
              await storage.updateAccountBalance(
                account.id,
                String(balanceToStore)
              );
            }
          } catch (error) {
            logger.error("Failed to fetch Teller account", { error, accountId: account.id });
          }
        }
      }
    }
    
    // Fetch updated accounts from database
    const updatedAccounts = await storage.getConnectedAccounts(userId);
    const finalBankAccounts = updatedAccounts
      .filter(acc => acc.accountType === 'bank' || acc.accountType === 'card')
      .map(account => ({
        id: account.id,
        name: account.accountName,
        type: account.accountType === 'bank' ? 
          (account.accountName.toLowerCase().includes('saving') ? 'savings' : 'checking') : 
          'credit',
        externalId: account.externalAccountId,
        institutionName: account.institutionName,
        lastFour: account.accountNumber ? account.accountNumber.slice(-4) : null,
        currency: account.currency || 'USD',
        balance: parseFloat(account.balance),
        lastSync: account.lastSynced
      }));
    
    res.json({ accounts: finalBankAccounts });
    
  } catch (error) {
    logger.error("Error fetching bank accounts", { error });
    res.status(500).json({ 
      message: "Failed to fetch bank accounts",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/banks/:id/transactions
 * Returns transactions for a specific bank/card account
 */
router.get("/banks/:id/transactions", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const accountId = parseInt(req.params.id);
    
    // Verify account ownership
    const account = await storage.getConnectedAccount(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ message: "Account not found" });
    }
    
    let transactions: any[] = [];
    
    // Fetch from Teller if available
    if (account.provider === 'teller' && account.accessToken) {
      try {
        const response = await fetch(`https://api.teller.io/accounts/${account.externalAccountId}/transactions`, {
          headers: {
            'Authorization': `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`,
          },
        });
        
        if (response.ok) {
          const tellerTransactions = await response.json();
          
          transactions = tellerTransactions.map((tx: any) => ({
            id: tx.id,
            description: tx.description,
            category: tx.details?.category || 'Other',
            amount: tx.amount,
            date: tx.date
          }));
        }
      } catch (error) {
        logger.error("Failed to fetch Teller transactions", { error });
      }
    }
    
    // If no live data, return transfers from database as fallback
    if (transactions.length === 0) {
      const transfers = await storage.getTransfers(userId, 100);
      transactions = transfers
        .filter(t => 
          t.fromAccountId === String(accountId) || 
          t.toAccountId === String(accountId)
        )
        .map(t => ({
          id: t.id,
          description: t.description || 'Transfer',
          category: 'Transfer',
          amount: t.fromAccountId === String(accountId) ? 
            -parseFloat(t.amount) : 
            parseFloat(t.amount),
          date: t.executedAt || t.createdAt
        }));
    }
    
    res.json({ transactions });
    
  } catch (error) {
    logger.error("Error fetching bank transactions", { error });
    res.status(500).json({ 
      message: "Failed to fetch transactions",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
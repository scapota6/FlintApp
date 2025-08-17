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
    const accounts = await storage.getConnectedAccounts(userId);
    const brokerageAccounts = accounts.filter(acc => acc.accountType === 'brokerage');
    
    // If SnapTrade is configured, fetch fresh data
    // SnapTrade integration always available via centralized config
      const snaptradeUser = await storage.getSnapTradeUser(userId);
      
      if (snaptradeUser?.snaptradeUserId && snaptradeUser?.userSecret) {
        try {
          // Fetch account data from SnapTrade
          const snaptradeAccounts = await accountsApi.listAccounts({
            userId: snaptradeUser.snaptradeUserId,
            userSecret: snaptradeUser.userSecret
          });
          
          // Update local database with fresh data
          for (const snapAccount of snaptradeAccounts) {
            const existingAccount = brokerageAccounts.find(
              acc => acc.externalAccountId === snapAccount.id
            );
            
            if (existingAccount) {
              // Update balance
              await storage.updateAccountBalance(
                existingAccount.id,
                String(snapAccount.balance?.total?.amount || 0)
              );
            }
          }
        } catch (error) {
          logger.error("Failed to fetch SnapTrade accounts", { error });
        }
      }
    }
    
    // Fetch updated accounts from database
    const updatedAccounts = await storage.getConnectedAccounts(userId);
    const finalBrokerageAccounts = updatedAccounts
      .filter(acc => acc.accountType === 'brokerage')
      .map(account => ({
        id: account.id,
        name: account.accountName,
        currency: account.currency || 'USD',
        balance: parseFloat(account.balance),
        buyingPower: parseFloat(account.balance) * 0.5, // Estimate buying power as 50% of balance
        lastSync: account.lastSynced
      }));
    
    res.json({ accounts: finalBrokerageAccounts });
    
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
              
              // Update balance in database
              await storage.updateAccountBalance(
                account.id,
                String(tellerAccount.balance?.available || 0)
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
          'card',
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
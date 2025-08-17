/**
 * Portfolio Summary Routes
 * Provides unified portfolio metrics and net worth calculations
 */

import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { marketDataService } from "../services/market-data";
import { logger } from "@shared/logger";
import { snaptradeClient } from "../lib/snaptrade";

const router = Router();

/**
 * GET /api/portfolio/summary
 * Returns comprehensive portfolio summary with net worth breakdown
 */
router.get("/summary", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Fetch all connected accounts
    const accounts = await storage.getConnectedAccounts(userId);
    
    // Initialize totals
    let totalCash = 0;
    let totalStocks = 0;
    let totalCrypto = 0;
    let totalDebt = 0;
    let totalDayChange = 0;
    let totalDayChangePercent = 0;
    let totalYtdChange = 0;
    let totalYtdChangePercent = 0;
    
    // Process each account
    for (const account of accounts) {
      const balance = parseFloat(account.balance);
      
      if (account.accountType === 'brokerage') {
        // Fetch holdings for brokerage accounts
        if (snaptradeClient && account.provider === 'snaptrade') {
          const snaptradeUser = await storage.getSnapTradeUser(userId);
          
          if (snaptradeUser?.snaptradeUserId && snaptradeUser?.userSecret) {
            try {
              // Get positions from SnapTrade
              const { data: positions } = await snaptradeClient.accountInformation.getUserAccountPositions({
                userId: snaptradeUser.snaptradeUserId,
                userSecret: snaptradeUser.userSecret,
                accountId: account.externalAccountId!
              });
              
              // Calculate stock values
              for (const position of positions) {
                const value = (position.units || 0) * (position.price || 0);
                const symbol = position.symbol?.symbol;
                
                // Determine asset type
                if (symbol && ['BTC', 'ETH', 'DOGE', 'ADA', 'SOL'].includes(symbol)) {
                  totalCrypto += value;
                } else {
                  totalStocks += value;
                }
                
                // Try to get real-time quote for performance calculation
                if (symbol) {
                  try {
                    const quote = await marketDataService.getMarketData(symbol);
                    if (quote) {
                      const dayChange = (position.units || 0) * (quote.change || 0);
                      totalDayChange += dayChange;
                    }
                  } catch (error) {
                    logger.error("Failed to fetch quote", { symbol, error });
                  }
                }
              }
              
              // Get cash balance
              const { data: balances } = await snaptradeClient.accountInformation.getUserAccountBalance({
                userId: snaptradeUser.snaptradeUserId,
                userSecret: snaptradeUser.userSecret,
                accountId: account.externalAccountId!
              });
              
              if (balances?.cash) {
                totalCash += balances.cash;
              }
              
            } catch (error) {
              logger.error("Failed to fetch SnapTrade data", { error, accountId: account.id });
              // Fall back to stored balance
              totalCash += balance;
            }
          } else {
            // No SnapTrade credentials, use stored balance
            totalCash += balance;
          }
        } else {
          // Non-SnapTrade brokerage, add to investable
          totalStocks += balance;
        }
        
      } else if (account.accountType === 'bank') {
        // Bank accounts contribute to cash
        if (account.accountName.toLowerCase().includes('checking') || 
            account.accountName.toLowerCase().includes('savings')) {
          totalCash += balance;
        }
        
      } else if (account.accountType === 'card') {
        // Credit cards are debt (negative balance)
        totalDebt += Math.abs(balance);
      }
    }
    
    // Fetch holdings from database as fallback
    const holdings = await storage.getHoldings(userId);
    
    // If we don't have live data, use database holdings
    if (totalStocks === 0 && holdings.length > 0) {
      for (const holding of holdings) {
        const value = parseFloat(holding.marketValue);
        const symbol = holding.symbol;
        
        // Determine asset type
        if (['BTC', 'ETH', 'DOGE', 'ADA', 'SOL'].includes(symbol)) {
          totalCrypto += value;
        } else {
          totalStocks += value;
        }
        
        // Add day change from holdings
        totalDayChange += parseFloat(holding.gainLoss);
      }
    }
    
    // Calculate totals
    const investable = totalStocks + totalCrypto;
    const netWorth = investable + totalCash - totalDebt;
    
    // Calculate performance percentages
    if (investable > 0) {
      totalDayChangePercent = (totalDayChange / investable) * 100;
      // YTD calculation would require historical data - using placeholder
      totalYtdChangePercent = totalDayChangePercent * 10; // Rough estimate
      totalYtdChange = investable * (totalYtdChangePercent / 100);
    }
    
    // Prepare breakdown for visualization
    const breakdown = [
      { bucket: 'Stocks', value: totalStocks },
      { bucket: 'Crypto', value: totalCrypto },
      { bucket: 'Cash', value: totalCash },
      { bucket: 'Credit Cards', value: -totalDebt }
    ].filter(item => Math.abs(item.value) > 0); // Only include non-zero values
    
    // Prepare response
    const summary = {
      totals: {
        netWorth: Math.round(netWorth * 100) / 100,
        investable: Math.round(investable * 100) / 100,
        cash: Math.round(totalCash * 100) / 100,
        debt: Math.round(totalDebt * 100) / 100
      },
      breakdown,
      performance: {
        dayPct: Math.round(totalDayChangePercent * 100) / 100,
        dayValue: Math.round(totalDayChange * 100) / 100,
        ytdPct: Math.round(totalYtdChangePercent * 100) / 100,
        ytdValue: Math.round(totalYtdChange * 100) / 100
      },
      metadata: {
        accountCount: accounts.length,
        lastUpdated: new Date().toISOString(),
        currency: 'USD',
        dataDelayed: false // Set to true if using cached data
      }
    };
    
    logger.info("Portfolio summary generated", { 
      userId, 
      netWorth: summary.totals.netWorth,
      accounts: accounts.length 
    });
    
    res.json(summary);
    
  } catch (error) {
    logger.error("Error generating portfolio summary", { error });
    res.status(500).json({ 
      message: "Failed to generate portfolio summary",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/portfolio/history
 * Returns historical portfolio values for charting
 */
router.get("/history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { period = '1D' } = req.query;
    
    // Generate mock historical data for charting
    // In production, this would fetch from a time-series database
    const now = Date.now();
    const dataPoints = [];
    let intervals = 24; // Default for 1D
    let intervalMs = 60 * 60 * 1000; // 1 hour
    
    switch (period) {
      case '1W':
        intervals = 7 * 24;
        intervalMs = 60 * 60 * 1000;
        break;
      case '1M':
        intervals = 30;
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case '3M':
        intervals = 90;
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case '1Y':
        intervals = 365;
        intervalMs = 24 * 60 * 60 * 1000;
        break;
    }
    
    // Get current portfolio value
    const accounts = await storage.getConnectedAccounts(userId);
    const totalValue = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
    
    // Generate historical points with some volatility
    for (let i = intervals; i >= 0; i--) {
      const timestamp = now - (i * intervalMs);
      const randomChange = (Math.random() - 0.5) * 0.02; // ±2% volatility
      const value = totalValue * (1 + randomChange * (i / intervals));
      
      dataPoints.push({
        timestamp: new Date(timestamp).toISOString(),
        value: Math.round(value * 100) / 100
      });
    }
    
    res.json({
      period,
      dataPoints,
      currency: 'USD'
    });
    
  } catch (error) {
    logger.error("Error fetching portfolio history", { error });
    res.status(500).json({ 
      message: "Failed to fetch portfolio history",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
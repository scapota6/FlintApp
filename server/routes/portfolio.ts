/**
 * Portfolio Summary Routes
 * Provides unified portfolio metrics and net worth calculations
 */

import { Router } from "express";
import { storage } from "../storage";
import { marketDataService } from "../services/market-data";
import { logger } from "@shared/logger";
import { getSnapUser } from "../store/snapUsers";

const router = Router();

/**
 * GET /api/portfolio/summary
 * Returns comprehensive portfolio summary with net worth breakdown
 */
router.get("/summary", async (req: any, res) => {
  try {
    // Get userId from session like dashboard route
    const userId = req.user?.claims?.sub;
    const userEmail = req.user?.claims?.email;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Initialize totals
    let totalCash = 0;
    let totalStocks = 0;
    let totalCrypto = 0;
    let totalDebt = 0;
    let totalDayChange = 0;
    let totalDayChangePercent = 0;
    let totalYtdChange = 0;
    let totalYtdChangePercent = 0;
    let accountCount = 0;

    // Fetch real investment account data from SnapTrade (same pattern as dashboard)
    try {
      console.log('Fetching SnapTrade accounts for portfolio user:', userEmail);
      
      // Use the same auth pattern as dashboard
      const snapUser = await getSnapUser(userId);
      if (snapUser?.userSecret) {
        const { accountsApi } = await import('../lib/snaptrade');
        const accounts = await accountsApi.listUserAccounts({
          userId: snapUser.userId,
          userSecret: snapUser.userSecret,
        });
        
        console.log('SnapTrade accounts for portfolio:', accounts.data?.length || 0);
        
        if (accounts.data && Array.isArray(accounts.data)) {
          accountCount = accounts.data.length;
          
          for (const account of accounts.data) {
            const balance = parseFloat(account.balance?.total?.amount || '0') || 0;
            const cash = parseFloat(account.balance?.cash?.amount || '0') || 0;
            const holdings = balance - cash;
            
            // Add to totals
            totalCash += cash;
            totalStocks += holdings; // Holdings represent invested value
            
            // Try to get positions for more detailed breakdown
            try {
              const { positionsApi } = await import('../lib/snaptrade');
              const positions = await positionsApi.getPositions({
                userId: snapUser.userId,
                userSecret: snapUser.userSecret,
                accountId: account.id
              });
              
              if (positions.data) {
                for (const position of positions.data) {
                  const value = (position.units || 0) * (position.price || 0);
                  const symbol = position.symbol?.symbol;
                  
                  // Determine if it's crypto
                  if (symbol && ['BTC', 'ETH', 'DOGE', 'ADA', 'SOL', 'USDC', 'USDT'].includes(symbol)) {
                    totalCrypto += value;
                    totalStocks -= value; // Remove from stocks and add to crypto
                  }
                }
              }
            } catch (posError) {
              console.log('Could not fetch positions for account:', account.id);
            }
          }
        }
      } else {
        console.log('SnapTrade credentials not available for portfolio user');
      }
    } catch (error: any) {
      console.error('Error fetching SnapTrade accounts for portfolio:', error);
    }

    // Fetch bank accounts
    try {
      console.log('Fetching bank accounts for portfolio user:', userEmail);
      const bankAccounts = await storage.getBankAccounts(userId);
      
      for (const account of bankAccounts) {
        const balance = parseFloat(account.balance) || 0;
        totalCash += balance;
        accountCount++;
      }
    } catch (error) {
      console.error('Error fetching bank accounts for portfolio:', error);
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
        accountCount: accountCount,
        lastUpdated: new Date().toISOString(),
        currency: 'USD',
        dataDelayed: false // Set to true if using cached data
      }
    };
    
    logger.info("Portfolio summary generated", { 
      userId, 
      netWorth: summary.totals.netWorth,
      accounts: accountCount 
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
 * Returns historical portfolio values for charting (query parameter version)
 */
router.get("/history", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const period = req.query.period || '1D';
    
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

/**
 * GET /api/portfolio/history/:period
 * Returns historical portfolio values for charting (path parameter version)
 */
router.get("/history/:period", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { period = '1D' } = req.params;
    
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
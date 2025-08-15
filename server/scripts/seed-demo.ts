/**
 * Demo Mode Seed Script
 * Generates mock data for testing the UI instantly
 */

import { db } from '../db';
import { 
  users, 
  connectedAccounts, 
  holdings, 
  trades, 
  watchlist, 
  priceAlerts,
  notificationPreferences,
  marketData
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Demo user configuration
const DEMO_USER_ID = 'demo-user-001';
const DEMO_USER_EMAIL = 'demo@flint.com';

// Mock data generation utilities
const generateRandomPrice = (base: number, variance: number = 0.1) => {
  const change = (Math.random() - 0.5) * 2 * variance;
  return +(base * (1 + change)).toFixed(2);
};

const generateRandomChange = () => {
  return +((Math.random() - 0.5) * 10).toFixed(2);
};

const generateCandleData = (symbol: string, days: number = 30) => {
  const candles = [];
  const basePrice = Math.random() * 500 + 50;
  const now = Date.now();
  
  for (let i = days; i >= 0; i--) {
    const timestamp = new Date(now - i * 24 * 60 * 60 * 1000);
    const open = generateRandomPrice(basePrice, 0.02);
    const close = generateRandomPrice(open, 0.02);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    const volume = Math.floor(Math.random() * 1000000) + 100000;
    
    candles.push({
      symbol,
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });
  }
  
  return candles;
};

// Mock brokerage accounts
const mockBrokerageAccounts = [
  {
    id: 'mock-brokerage-1',
    name: 'Demo Brokerage - Growth Portfolio',
    type: 'brokerage' as const,
    provider: 'snaptrade',
    balance: 125000.50,
    currency: 'USD',
    isActive: true
  },
  {
    id: 'mock-brokerage-2',
    name: 'Demo Brokerage - Retirement Account',
    type: 'brokerage' as const,
    provider: 'snaptrade',
    balance: 450000.75,
    currency: 'USD',
    isActive: true
  }
];

// Mock bank accounts
const mockBankAccounts = [
  {
    id: 'mock-bank-1',
    name: 'Demo Checking Account',
    type: 'bank' as const,
    provider: 'teller',
    balance: 15000.25,
    currency: 'USD',
    isActive: true
  },
  {
    id: 'mock-bank-2',
    name: 'Demo Savings Account',
    type: 'bank' as const,
    provider: 'teller',
    balance: 50000.00,
    currency: 'USD',
    isActive: true
  }
];

// Mock holdings
const mockHoldings = [
  { symbol: 'AAPL', name: 'Apple Inc.', quantity: 100, costBasis: 15000, currentPrice: 175.50 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 50, costBasis: 6000, currentPrice: 140.25 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', quantity: 75, costBasis: 22500, currentPrice: 375.00 },
  { symbol: 'TSLA', name: 'Tesla Inc.', quantity: 30, costBasis: 7500, currentPrice: 250.00 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', quantity: 25, costBasis: 3750, currentPrice: 155.00 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', quantity: 40, costBasis: 18000, currentPrice: 475.50 },
  { symbol: 'META', name: 'Meta Platforms', quantity: 60, costBasis: 18000, currentPrice: 325.75 },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', quantity: 20, costBasis: 7000, currentPrice: 365.00 },
];

// Mock trades
const mockTrades = [
  { symbol: 'AAPL', side: 'buy', quantity: 10, price: 170.00, status: 'filled', orderType: 'market' },
  { symbol: 'GOOGL', side: 'sell', quantity: 5, price: 142.50, status: 'filled', orderType: 'limit' },
  { symbol: 'TSLA', side: 'buy', quantity: 15, price: 245.00, status: 'pending', orderType: 'limit' },
  { symbol: 'NVDA', side: 'buy', quantity: 20, price: 470.00, status: 'filled', orderType: 'market' },
  { symbol: 'MSFT', side: 'sell', quantity: 10, price: 380.00, status: 'cancelled', orderType: 'stop' },
];

// Mock watchlist items
const mockWatchlist = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { symbol: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'ETH-USD', name: 'Ethereum' },
];

// Mock price alerts
const mockAlerts = [
  { symbol: 'AAPL', targetPrice: 180.00, alertType: 'above', message: 'Apple reaching new high' },
  { symbol: 'TSLA', targetPrice: 230.00, alertType: 'below', message: 'Tesla buying opportunity' },
  { symbol: 'NVDA', targetPrice: 500.00, alertType: 'above', message: 'NVIDIA breakout alert' },
];

export async function seedDemoData() {
  console.log('🌱 Starting demo data seed...');
  
  try {
    // Check if demo user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, DEMO_USER_ID));
    
    if (existingUser) {
      console.log('Demo user already exists, cleaning up old data...');
      
      // Clean up existing demo data
      await db.delete(connectedAccounts).where(eq(connectedAccounts.userId, DEMO_USER_ID));
      await db.delete(holdings).where(eq(holdings.userId, DEMO_USER_ID));
      await db.delete(trades).where(eq(trades.userId, DEMO_USER_ID));
      await db.delete(watchlist).where(eq(watchlist.userId, DEMO_USER_ID));
      await db.delete(priceAlerts).where(eq(priceAlerts.userId, DEMO_USER_ID));
      await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, DEMO_USER_ID));
    } else {
      // Create demo user
      console.log('Creating demo user...');
      await db.insert(users).values({
        id: DEMO_USER_ID,
        email: DEMO_USER_EMAIL,
        firstName: 'Demo',
        lastName: 'User',
        profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
        subscriptionTier: 'premium',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Insert connected accounts
    console.log('Creating mock connected accounts...');
    const accountsToInsert = [
      ...mockBrokerageAccounts.map(account => ({
        ...account,
        userId: DEMO_USER_ID,
        accountNumber: `XXXX${Math.floor(Math.random() * 10000)}`,
        lastSynced: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      ...mockBankAccounts.map(account => ({
        ...account,
        userId: DEMO_USER_ID,
        accountNumber: `XXXX${Math.floor(Math.random() * 10000)}`,
        lastSynced: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    ];
    
    await db.insert(connectedAccounts).values(accountsToInsert);
    
    // Insert holdings
    console.log('Creating mock holdings...');
    const holdingsToInsert = mockHoldings.map(holding => ({
      userId: DEMO_USER_ID,
      accountId: mockBrokerageAccounts[0].id,
      symbol: holding.symbol,
      name: holding.name,
      quantity: holding.quantity,
      averageCost: holding.costBasis / holding.quantity,
      marketValue: holding.quantity * holding.currentPrice,
      costBasis: holding.costBasis,
      gainLoss: (holding.quantity * holding.currentPrice) - holding.costBasis,
      gainLossPercentage: ((holding.quantity * holding.currentPrice - holding.costBasis) / holding.costBasis) * 100,
      assetType: 'stock' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await db.insert(holdings).values(holdingsToInsert);
    
    // Insert trades
    console.log('Creating mock trades...');
    const tradesToInsert = mockTrades.map((trade, index) => ({
      userId: DEMO_USER_ID,
      accountId: mockBrokerageAccounts[0].id,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      totalAmount: trade.quantity * trade.price,
      status: trade.status,
      orderType: trade.orderType,
      executedAt: trade.status === 'filled' ? new Date(Date.now() - index * 86400000) : null,
      createdAt: new Date(Date.now() - index * 86400000),
      updatedAt: new Date()
    }));
    
    await db.insert(trades).values(tradesToInsert);
    
    // Insert watchlist items
    console.log('Creating mock watchlist...');
    const watchlistToInsert = mockWatchlist.map(item => ({
      userId: DEMO_USER_ID,
      symbol: item.symbol,
      name: item.name,
      addedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await db.insert(watchlist).values(watchlistToInsert);
    
    // Insert price alerts
    console.log('Creating mock price alerts...');
    const alertsToInsert = mockAlerts.map(alert => ({
      userId: DEMO_USER_ID,
      symbol: alert.symbol,
      targetPrice: alert.targetPrice,
      alertType: alert.alertType,
      message: alert.message,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await db.insert(priceAlerts).values(alertsToInsert);
    
    // Insert notification preferences
    console.log('Setting up notification preferences...');
    await db.insert(notificationPreferences).values({
      userId: DEMO_USER_ID,
      emailEnabled: true,
      pushEnabled: true,
      priceAlerts: true,
      tradeConfirmations: true,
      accountUpdates: true,
      marketNews: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Generate market data candles
    console.log('Generating mock market data candles...');
    const symbols = [...mockHoldings.map(h => h.symbol), ...mockWatchlist.map(w => w.symbol)];
    
    for (const symbol of symbols) {
      const candles = generateCandleData(symbol, 30);
      
      // Insert candles (you may need to add a marketData table if not exists)
      // For now, we'll just log that we would insert them
      console.log(`Generated ${candles.length} candles for ${symbol}`);
    }
    
    console.log('✅ Demo data seed completed successfully!');
    console.log(`
    Demo User Credentials:
    - User ID: ${DEMO_USER_ID}
    - Email: ${DEMO_USER_EMAIL}
    
    Mock Data Created:
    - ${accountsToInsert.length} connected accounts
    - ${holdingsToInsert.length} holdings
    - ${tradesToInsert.length} trades
    - ${watchlistToInsert.length} watchlist items
    - ${alertsToInsert.length} price alerts
    `);
    
    return {
      userId: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      stats: {
        accounts: accountsToInsert.length,
        holdings: holdingsToInsert.length,
        trades: tradesToInsert.length,
        watchlist: watchlistToInsert.length,
        alerts: alertsToInsert.length
      }
    };
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  }
}

// Export for CLI usage
export default seedDemoData;
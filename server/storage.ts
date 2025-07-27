import {
  users,
  connectedAccounts,
  holdings,
  watchlist,
  trades,
  transfers,
  activityLog,
  marketData,
  brokerageConnections,
  brokerageAccounts,
  bankAccounts,
  tradingOrders,
  type User,
  type UpsertUser,
  type ConnectedAccount,
  type InsertConnectedAccount,
  type Holding,
  type InsertHolding,
  type WatchlistItem,
  type InsertWatchlistItem,
  type Trade,
  type InsertTrade,
  type Transfer,
  type InsertTransfer,
  type ActivityLog,
  type InsertActivityLog,
  type MarketData,
  type InsertMarketData,
  type BrokerageConnection,
  type InsertBrokerageConnection,
  type BrokerageAccount,
  type InsertBrokerageAccount,
  type BankAccount,
  type InsertBankAccount,
  type TradingOrder,
  type InsertTradingOrder,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, isNotNull } from "drizzle-orm";
// Removed encryption import - storing plaintext for debugging

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  
  // SnapTrade user management
  getSnapTradeUser(userId: string): Promise<{ snaptradeUserId: string | null, userSecret: string } | undefined>;
  createSnapTradeUser(userId: string, snaptradeUserId: string, userSecret: string): Promise<void>;
  deleteSnapTradeUser(userId: string): Promise<void>;
  
  // Connected accounts
  getConnectedAccounts(userId: string): Promise<ConnectedAccount[]>;
  createConnectedAccount(account: InsertConnectedAccount): Promise<ConnectedAccount>;
  updateAccountBalance(accountId: number, balance: string): Promise<void>;
  getConnectedAccount(accountId: number): Promise<ConnectedAccount | undefined>;
  deleteConnectedAccount(userId: string, provider: string, accountId: string): Promise<number>;
  
  // Holdings
  getHoldings(userId: string): Promise<Holding[]>;
  getHoldingsByAccount(accountId: number): Promise<Holding[]>;
  upsertHolding(holding: InsertHolding): Promise<Holding>;
  
  // Watchlist
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeFromWatchlist(userId: string, symbol: string): Promise<void>;
  
  // Trades
  getTrades(userId: string, limit?: number): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTradeStatus(tradeId: number, status: string, executedAt?: Date): Promise<void>;
  
  // Transfers
  getTransfers(userId: string, limit?: number): Promise<Transfer[]>;
  createTransfer(transfer: InsertTransfer): Promise<Transfer>;
  updateTransferStatus(transferId: number, status: string, executedAt?: Date): Promise<void>;
  
  // Activity log
  getActivityLog(userId: string, limit?: number): Promise<ActivityLog[]>;
  logActivity(activity: InsertActivityLog): Promise<ActivityLog>;
  
  // Market data
  getMarketData(symbols: string[]): Promise<MarketData[]>;
  updateMarketData(data: InsertMarketData): Promise<MarketData>;
  
  // Brokerage connections (SnapTrade)
  getBrokerageConnections(userId: string): Promise<BrokerageConnection[]>;
  createBrokerageConnection(connection: InsertBrokerageConnection): Promise<BrokerageConnection>;
  updateBrokerageConnection(connectionId: string, data: Partial<BrokerageConnection>): Promise<BrokerageConnection>;
  deleteBrokerageConnection(connectionId: string): Promise<void>;
  
  // Brokerage accounts
  getBrokerageAccounts(connectionId: string): Promise<BrokerageAccount[]>;
  getAllBrokerageAccounts(userId: string): Promise<BrokerageAccount[]>;
  createBrokerageAccount(account: InsertBrokerageAccount): Promise<BrokerageAccount>;
  updateBrokerageAccount(accountId: string, data: Partial<BrokerageAccount>): Promise<BrokerageAccount>;
  
  // Bank accounts (Teller)
  getBankAccounts(userId: string): Promise<BankAccount[]>;
  createBankAccount(account: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(accountId: string, data: Partial<BankAccount>): Promise<BankAccount>;
  
  // Trading orders
  getTradingOrders(userId: string, limit?: number): Promise<TradingOrder[]>;
  createTradingOrder(order: InsertTradingOrder): Promise<TradingOrder>;
  updateTradingOrder(orderId: string, data: Partial<TradingOrder>): Promise<TradingOrder>;
  
  // User updates
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        stripeCustomerId, 
        stripeSubscriptionId,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // SnapTrade user management
  async getSnapTradeUser(userId: string): Promise<{ snaptradeUserId: string | null, userSecret: string } | undefined> {
    const [user] = await db
      .select({ 
        snaptradeUserId: users.snaptradeUserId,
        userSecret: users.snaptradeUserSecret 
      })
      .from(users)
      .where(eq(users.id, userId));
    
    if (user?.userSecret) {
      // Return userSecret directly from DB without decryption
      return { 
        snaptradeUserId: user.snaptradeUserId, 
        userSecret: user.userSecret 
      };
    }
    
    return undefined;
  }

  async createSnapTradeUser(userId: string, snaptradeUserId: string, userSecret: string): Promise<void> {
    // Store userSecret directly in DB without encryption
    await db
      .update(users)
      .set({
        snaptradeUserId: snaptradeUserId,
        snaptradeUserSecret: userSecret, // Store userSecret directly
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async deleteSnapTradeUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        snaptradeUserId: null,
        snaptradeUserSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Connected accounts
  async getConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
    return await db
      .select()
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.isActive, true)))
      .orderBy(asc(connectedAccounts.createdAt));
  }

  async createConnectedAccount(account: InsertConnectedAccount): Promise<ConnectedAccount> {
    const [newAccount] = await db
      .insert(connectedAccounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async updateAccountBalance(accountId: number, balance: string): Promise<void> {
    await db
      .update(connectedAccounts)
      .set({ balance, lastSynced: new Date(), updatedAt: new Date() })
      .where(eq(connectedAccounts.id, accountId));
  }

  async getConnectedAccount(accountId: number): Promise<ConnectedAccount | undefined> {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, accountId));
    return account;
  }

  async deleteConnectedAccount(userId: string, provider: string, accountId: string): Promise<number> {
    const result = await db
      .delete(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, provider),
        eq(connectedAccounts.externalAccountId, accountId)
      ));
    return result.rowCount || 0;
  }

  // Holdings
  async getHoldings(userId: string): Promise<Holding[]> {
    return await db
      .select()
      .from(holdings)
      .where(eq(holdings.userId, userId))
      .orderBy(desc(holdings.marketValue));
  }

  async getHoldingsByAccount(accountId: number): Promise<Holding[]> {
    return await db
      .select()
      .from(holdings)
      .where(eq(holdings.accountId, accountId))
      .orderBy(desc(holdings.marketValue));
  }

  async upsertHolding(holding: InsertHolding): Promise<Holding> {
    const [newHolding] = await db
      .insert(holdings)
      .values(holding)
      .onConflictDoUpdate({
        target: [holdings.userId, holdings.accountId, holdings.symbol],
        set: {
          ...holding,
          updatedAt: new Date(),
        },
      })
      .returning();
    return newHolding;
  }

  // Watchlist
  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(asc(watchlist.createdAt));
  }

  async addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const [newItem] = await db
      .insert(watchlist)
      .values(item)
      .returning();
    return newItem;
  }

  async removeFromWatchlist(userId: string, symbol: string): Promise<void> {
    await db
      .delete(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol)));
  }

  // Trades
  async getTrades(userId: string, limit: number = 50): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .where(eq(trades.userId, userId))
      .orderBy(desc(trades.createdAt))
      .limit(limit);
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db
      .insert(trades)
      .values(trade)
      .returning();
    return newTrade;
  }

  async updateTradeStatus(tradeId: number, status: string, executedAt?: Date): Promise<void> {
    await db
      .update(trades)
      .set({ status, executedAt })
      .where(eq(trades.id, tradeId));
  }

  // Transfers
  async getTransfers(userId: string, limit: number = 50): Promise<Transfer[]> {
    return await db
      .select()
      .from(transfers)
      .where(eq(transfers.userId, userId))
      .orderBy(desc(transfers.createdAt))
      .limit(limit);
  }

  async createTransfer(transfer: InsertTransfer): Promise<Transfer> {
    const [newTransfer] = await db
      .insert(transfers)
      .values(transfer)
      .returning();
    return newTransfer;
  }

  async updateTransferStatus(transferId: number, status: string, executedAt?: Date): Promise<void> {
    await db
      .update(transfers)
      .set({ status, executedAt })
      .where(eq(transfers.id, transferId));
  }

  // Activity log
  async getActivityLog(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.userId, userId))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }

  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const [newActivity] = await db
      .insert(activityLog)
      .values(activity)
      .returning();
    return newActivity;
  }

  // Market data
  async getMarketData(symbols: string[]): Promise<MarketData[]> {
    return await db
      .select()
      .from(marketData)
      .where(eq(marketData.symbol, symbols[0])); // Simplified for demo
  }

  async updateMarketData(data: InsertMarketData): Promise<MarketData> {
    const [newData] = await db
      .insert(marketData)
      .values(data)
      .onConflictDoUpdate({
        target: marketData.symbol,
        set: {
          ...data,
          lastUpdated: new Date(),
        },
      })
      .returning();
    return newData;
  }

  // SnapTrade user management (addition)
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllSnapTradeUsers(): Promise<Array<{ userId: string; snaptradeUserId: string; snaptradeUserSecret: string }>> {
    const result = await db.select({
      userId: users.id,
      snaptradeUserId: users.snaptradeUserId,
      snaptradeUserSecret: users.snaptradeUserSecret
    }).from(users).where(isNotNull(users.snaptradeUserSecret));
    
    // Filter out null values at runtime
    return result.filter(user => 
      user.snaptradeUserId !== null && 
      user.snaptradeUserSecret !== null
    ) as Array<{ userId: string; snaptradeUserId: string; snaptradeUserSecret: string }>;
  }
  
  // Additional methods used by routes.ts  
  async createActivityLog(activity: InsertActivityLog): Promise<ActivityLog> {
    return this.logActivity(activity);
  }

  // SnapTrade user methods required by enhanced routes
  async getSnapTradeUser(userId: string): Promise<{ snaptradeUserId: string | null; userSecret: string | null } | null> {
    const [user] = await db.select({
      snaptradeUserId: users.snaptradeUserId,
      userSecret: users.snaptradeUserSecret
    }).from(users).where(eq(users.id, userId));
    
    return user || null;
  }

  async createSnapTradeUser(userId: string, snaptradeUserId: string, userSecret: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        snaptradeUserId,
        snaptradeUserSecret: userSecret,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }
  
  async createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    return this.addToWatchlist(item);
  }
  
  async deleteWatchlistItem(id: number, userId: string): Promise<void> {
    await db
      .delete(watchlist)
      .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
  }
  
  async getActivityLogs(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    return this.getActivityLog(userId, limit);
  }
  
  async updateUserSubscription(userId: string, tier: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        subscriptionTier: tier,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Brokerage connections implementation
  async getBrokerageConnections(userId: string): Promise<BrokerageConnection[]> {
    return db.select().from(brokerageConnections).where(eq(brokerageConnections.userId, userId));
  }

  async createBrokerageConnection(connection: InsertBrokerageConnection): Promise<BrokerageConnection> {
    const [result] = await db.insert(brokerageConnections).values(connection).returning();
    return result;
  }

  async updateBrokerageConnection(connectionId: string, data: Partial<BrokerageConnection>): Promise<BrokerageConnection> {
    const [result] = await db
      .update(brokerageConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(brokerageConnections.id, connectionId))
      .returning();
    return result;
  }

  async deleteBrokerageConnection(connectionId: string): Promise<void> {
    await db.delete(brokerageConnections).where(eq(brokerageConnections.id, connectionId));
  }

  // Brokerage accounts implementation
  async getBrokerageAccounts(connectionId: string): Promise<BrokerageAccount[]> {
    return db.select().from(brokerageAccounts).where(eq(brokerageAccounts.connectionId, connectionId));
  }

  async getAllBrokerageAccounts(userId: string): Promise<BrokerageAccount[]> {
    const results = await db
      .select({
        id: brokerageAccounts.id,
        connectionId: brokerageAccounts.connectionId,
        snaptradeAccountId: brokerageAccounts.snaptradeAccountId,
        accountNumber: brokerageAccounts.accountNumber,
        accountName: brokerageAccounts.accountName,
        accountType: brokerageAccounts.accountType,
        balance: brokerageAccounts.balance,
        buyingPower: brokerageAccounts.buyingPower,
        currency: brokerageAccounts.currency,
        isActive: brokerageAccounts.isActive,
        metadata: brokerageAccounts.metadata,
        createdAt: brokerageAccounts.createdAt,
        updatedAt: brokerageAccounts.updatedAt,
      })
      .from(brokerageAccounts)
      .innerJoin(brokerageConnections, eq(brokerageAccounts.connectionId, brokerageConnections.id))
      .where(eq(brokerageConnections.userId, userId));
    
    return results;
  }

  async createBrokerageAccount(account: InsertBrokerageAccount): Promise<BrokerageAccount> {
    const [result] = await db.insert(brokerageAccounts).values(account).returning();
    return result;
  }

  async updateBrokerageAccount(accountId: string, data: Partial<BrokerageAccount>): Promise<BrokerageAccount> {
    const [result] = await db
      .update(brokerageAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(brokerageAccounts.id, accountId))
      .returning();
    return result;
  }

  // Bank accounts implementation
  async getBankAccounts(userId: string): Promise<BankAccount[]> {
    return db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
  }

  async createBankAccount(account: InsertBankAccount): Promise<BankAccount> {
    const [result] = await db.insert(bankAccounts).values(account).returning();
    return result;
  }

  async updateBankAccount(accountId: string, data: Partial<BankAccount>): Promise<BankAccount> {
    const [result] = await db
      .update(bankAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bankAccounts.id, accountId))
      .returning();
    return result;
  }

  // Trading orders implementation
  async getTradingOrders(userId: string, limit: number = 50): Promise<TradingOrder[]> {
    return db
      .select()
      .from(tradingOrders)
      .where(eq(tradingOrders.userId, userId))
      .orderBy(desc(tradingOrders.createdAt))
      .limit(limit);
  }

  async createTradingOrder(order: InsertTradingOrder): Promise<TradingOrder> {
    const [result] = await db.insert(tradingOrders).values(order).returning();
    return result;
  }

  async updateTradingOrder(orderId: string, data: Partial<TradingOrder>): Promise<TradingOrder> {
    const [result] = await db
      .update(tradingOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tradingOrders.id, orderId))
      .returning();
    return result;
  }
}

export const storage = new DatabaseStorage();

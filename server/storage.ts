import {
  users,
  snaptradeUsers,
  connectedAccounts,
  holdings,
  watchlist,
  trades,
  transfers,
  activityLog,
  marketData,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, isNotNull } from "drizzle-orm";
// Removed encryption import - storing plaintext for debugging

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUserSubscription(userId: string, tier: string, status: string): Promise<User>;
  updateUserBanStatus(userId: string, isBanned: boolean): Promise<User>;
  updateLastLogin(userId: string): Promise<void>;
  
  // SnapTrade user management
  getSnapTradeUser(userId: string): Promise<{ snaptradeUserId: string | null, userSecret: string } | undefined>;
  getSnapTradeUserByEmail(email: string): Promise<{ snaptradeUserId: string | null, snaptradeUserSecret: string, flintUserId: string } | undefined>;
  createSnapTradeUser(userId: string, snaptradeUserId: string, userSecret: string): Promise<void>;
  upsertSnapTradeUser(userId: string, email: string, userSecret: string): Promise<void>;
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
  
  // Bank data methods
  getBankAccounts(userEmail: string): Promise<any[]>;
  getBankTransactions(userEmail: string, accountId: string): Promise<any[]>;
  
  // Additional connected account methods
  getConnectedAccountByExternalId(externalAccountId: string): Promise<ConnectedAccount | undefined>;
  getConnectedAccountsByProvider(userId: string, provider: string): Promise<ConnectedAccount[]>;
  
  // Activity logging
  createActivity(activity: InsertActivityLog): Promise<ActivityLog>;
  
  // Teller webhook methods
  markEnrollmentDisconnected(enrollmentId: string, reason: string): Promise<void>;
  upsertTransaction(transaction: any): Promise<void>;
  updateAccountVerificationStatus(accountId: string, status: string): Promise<void>;
  
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

  // SnapTrade user management - using separate snaptradeUsers table
  async getSnapTradeUser(userId: string): Promise<{ snaptradeUserId: string | null, userSecret: string } | undefined> {
    const { getSnapUser } = await import('./store/snapUsers');
    const snapUser = await getSnapUser(userId);
    
    if (snapUser) {
      return { 
        snaptradeUserId: snapUser.userId, 
        userSecret: snapUser.userSecret 
      };
    }
    
    return undefined;
  }

  async getSnapTradeUserByEmail(email: string): Promise<{ snaptradeUserId: string | null, snaptradeUserSecret: string, flintUserId: string } | undefined> {
    // First get the user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    
    if (!user) {
      return undefined;
    }

    // Then get their SnapTrade credentials from file-based storage
    const { getSnapUser } = await import('./store/snapUsers');
    const snapUser = await getSnapUser(user.id);
    
    if (snapUser) {
      return { 
        snaptradeUserId: snapUser.userId, 
        snaptradeUserSecret: snapUser.userSecret,
        flintUserId: user.id
      };
    }
    
    return undefined;
  }

  async createSnapTradeUser(userId: string, snaptradeUserId: string, userSecret: string): Promise<void> {
    // Store in file-based storage
    const { saveSnapUser } = await import('./store/snapUsers');
    await saveSnapUser({ userId: snaptradeUserId, userSecret });
  }

  async upsertSnapTradeUser(userId: string, email: string, userSecret: string): Promise<void> {
    // Store in file-based storage using Flint userId as key
    const { saveSnapUser } = await import('./store/snapUsers');
    await saveSnapUser({ userId, userSecret });
  }

  async deleteSnapTradeUser(userId: string): Promise<void> {
    const { deleteSnapUser } = await import('./store/snapUsers');
    await deleteSnapUser(userId);
  }

  // Connected accounts
  async getConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
    return await db
      .select({
        id: connectedAccounts.id,
        userId: connectedAccounts.userId,
        accountType: connectedAccounts.accountType,
        provider: connectedAccounts.provider,
        institutionName: connectedAccounts.institutionName,
        accountName: connectedAccounts.accountName,
        accountNumber: connectedAccounts.accountNumber,
        balance: connectedAccounts.balance,
        currency: connectedAccounts.currency,
        isActive: connectedAccounts.isActive,
        // status: connectedAccounts.status, -- removed: status column doesn't exist in DB
        lastSynced: connectedAccounts.lastSynced,
        lastCheckedAt: connectedAccounts.lastCheckedAt,
        accessToken: connectedAccounts.accessToken,
        refreshToken: connectedAccounts.refreshToken,
        externalAccountId: connectedAccounts.externalAccountId,
        connectionId: connectedAccounts.connectionId,
        institutionId: connectedAccounts.institutionId,
        createdAt: connectedAccounts.createdAt,
        updatedAt: connectedAccounts.updatedAt,
      })
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

  async getConnectedAccountByExternalId(userId: string, provider: string, externalAccountId: string): Promise<ConnectedAccount | undefined> {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, provider),
        eq(connectedAccounts.externalAccountId, externalAccountId),
        eq(connectedAccounts.isActive, true)
      ));
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
      userId: snaptradeUsers.flintUserId,
      snaptradeUserId: snaptradeUsers.snaptradeUserId,
      snaptradeUserSecret: snaptradeUsers.snaptradeUserSecret
    }).from(snaptradeUsers);
    
    return result;
  }
  
  // Additional methods used by routes.ts  
  async createActivityLog(activity: InsertActivityLog): Promise<ActivityLog> {
    return this.logActivity(activity);
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
  
  async updateUserSubscription(userId: string, tier: string, status: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        subscriptionTier: tier,
        subscriptionStatus: status,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserBanStatus(userId: string, isBanned: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        isBanned,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        lastLogin: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  // Payment record methods
  async createPaymentRecord(payment: any): Promise<any> {
    // In a real implementation, this would store in a payments table
    return payment;
  }

  async getPaymentRecord(userId: string, paymentId: string): Promise<any> {
    // In a real implementation, this would fetch from payments table
    return null;
  }

  async updatePaymentStatus(paymentId: string, status: string): Promise<void> {
    // In a real implementation, this would update payments table
  }

  // Additional connected account methods
  async getConnectedAccountByExternalId(userId: string, provider: string, externalAccountId: string): Promise<ConnectedAccount | undefined> {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, provider),
        eq(connectedAccounts.externalAccountId, externalAccountId)
      ));
    return account;
  }
  
  async getConnectedAccountsByProvider(userId: string, provider: string): Promise<ConnectedAccount[]> {
    return db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, userId),
          eq(connectedAccounts.provider, provider)
        )
      );
  }
  
  // Activity logging - simplified to alias logActivity
  async createActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    return this.logActivity(activity);
  }
  
  // Teller webhook methods
  async markEnrollmentDisconnected(enrollmentId: string, reason: string): Promise<void> {
    // Update all accounts with this enrollment ID to disconnected status
    await db
      .update(connectedAccounts)
      .set({ 
        status: 'disconnected',
        metadata: { disconnectReason: reason },
        updatedAt: new Date()
      })
      .where(eq(connectedAccounts.connectionId, enrollmentId));
  }

  async deactivateAccount(accountId: number): Promise<void> {
    // Mark account as inactive so it won't show up in future queries
    await db
      .update(connectedAccounts)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(connectedAccounts.id, accountId));
  }

  async updateConnectedAccountActive(accountId: number, isActive: boolean): Promise<void> {
    await db
      .update(connectedAccounts)
      .set({ 
        isActive,
        updatedAt: new Date()
      })
      .where(eq(connectedAccounts.id, accountId));
  }

  async updateAccountConnectionStatus(accountId: number, status: 'connected' | 'disconnected' | 'expired'): Promise<void> {
    await db
      .update(connectedAccounts)
      .set({ 
        status,
        lastCheckedAt: new Date(),
        isActive: status === 'connected',
        updatedAt: new Date()
      })
      .where(eq(connectedAccounts.id, accountId));
  }

  async getAccountsForHealthCheck(): Promise<ConnectedAccount[]> {
    return db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.isActive, true));
  }
  
  async upsertTransaction(transaction: any): Promise<void> {
    // Store transaction data - would need a transactions table
    // For now, just log it
    logger.info("Transaction received via webhook", { transaction });
  }
  
  async updateAccountVerificationStatus(accountId: string, status: string): Promise<void> {
    // Update account verification status
    await db
      .update(connectedAccounts)
      .set({ 
        metadata: { verificationStatus: status },
        updatedAt: new Date()
      })
      .where(eq(connectedAccounts.externalAccountId, accountId));
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Bank account methods - real implementations required for Teller.io integration
  async getBankAccounts(userEmail: string): Promise<any[]> {
    // TODO: Implement real Teller.io API call
    // For now, return empty array until Teller.io credentials are provided
    return [];
  }

  async getBankTransactions(userEmail: string, accountId: string): Promise<any[]> {
    // TODO: Implement real Teller.io API call  
    // For now, return empty array until Teller.io credentials are provided
    return [];
  }
}

export const storage = new DatabaseStorage();

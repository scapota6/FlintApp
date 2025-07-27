import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  decimal,
  integer,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from 'drizzle-orm';

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionTier: varchar("subscription_tier").default("free"), // free, basic, pro, premium
  subscriptionStatus: varchar("subscription_status").default("active"), // active, cancelled, expired
  snaptradeUserId: varchar("snaptrade_user_id"), // SnapTrade user ID
  snaptradeUserSecret: varchar("snaptrade_user_secret"), // SnapTrade user secret
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Connected accounts (banks, brokerages, crypto)
export const connectedAccounts = pgTable("connected_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  accountType: varchar("account_type").notNull(), // bank, brokerage, crypto
  provider: varchar("provider").notNull(), // teller, snaptrade
  institutionName: varchar("institution_name").notNull(),
  accountName: varchar("account_name").notNull(),
  accountNumber: varchar("account_number"),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  isActive: boolean("is_active").default(true),
  lastSynced: timestamp("last_synced").defaultNow(),
  accessToken: varchar("access_token"), // API access token
  refreshToken: varchar("refresh_token"), // refresh token if needed
  externalAccountId: varchar("external_account_id"), // provider's account ID
  connectionId: varchar("connection_id"), // provider's connection ID
  institutionId: varchar("institution_id"), // provider's institution ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Holdings (stocks, crypto, etc.)
export const holdings = pgTable("holdings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => connectedAccounts.id).notNull(),
  symbol: varchar("symbol").notNull(),
  name: varchar("name").notNull(),
  assetType: varchar("asset_type").notNull(), // stock, crypto, etf, etc.
  quantity: decimal("quantity", { precision: 15, scale: 8 }).notNull(),
  averagePrice: decimal("average_price", { precision: 15, scale: 2 }).notNull(),
  currentPrice: decimal("current_price", { precision: 15, scale: 2 }).notNull(),
  marketValue: decimal("market_value", { precision: 15, scale: 2 }).notNull(),
  gainLoss: decimal("gain_loss", { precision: 15, scale: 2 }).notNull(),
  gainLossPercentage: decimal("gain_loss_percentage", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Watchlist
export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  symbol: varchar("symbol").notNull(),
  name: varchar("name").notNull(),
  assetType: varchar("asset_type").notNull(),
  currentPrice: decimal("current_price", { precision: 15, scale: 2 }).notNull(),
  changePercent: decimal("change_percent", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Trades
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  accountId: varchar("account_id").notNull(),
  symbol: varchar("symbol").notNull(),
  assetType: varchar("asset_type").notNull(),
  side: varchar("side").notNull(), // buy, sell
  quantity: decimal("quantity", { precision: 15, scale: 8 }).notNull(),
  price: decimal("price", { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  orderType: varchar("order_type").notNull(), // market, limit, stop
  status: varchar("status").notNull(), // pending, filled, cancelled
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transfers
export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  fromAccountId: varchar("from_account_id").notNull(),
  toAccountId: varchar("to_account_id").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  status: varchar("status").notNull(), // pending, completed, failed
  description: text("description"),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity log
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: varchar("action").notNull(), // login, trade, transfer, watchlist_add, etc.
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// SnapTrade brokerage connections
export const brokerageConnections = pgTable("brokerage_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  snaptradeConnectionId: varchar("snaptrade_connection_id").notNull(),
  brokerageName: varchar("brokerage_name").notNull(),
  brokerageSlug: varchar("brokerage_slug"),
  accountType: varchar("account_type"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Brokerage accounts within connections  
export const brokerageAccounts = pgTable("brokerage_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull().references(() => brokerageConnections.id, { onDelete: "cascade" }),
  snaptradeAccountId: varchar("snaptrade_account_id").notNull(),
  accountNumber: varchar("account_number"),
  accountName: varchar("account_name"),
  accountType: varchar("account_type"),
  balance: decimal("balance", { precision: 15, scale: 2 }),
  buyingPower: decimal("buying_power", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("USD"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bank accounts from Teller
export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tellerAccountId: varchar("teller_account_id").notNull(),
  institutionName: varchar("institution_name"),
  accountName: varchar("account_name"),
  accountType: varchar("account_type"),
  lastFour: varchar("last_four"),
  balance: decimal("balance", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("USD"),
  routingNumber: varchar("routing_number"),
  accountNumber: varchar("account_number"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trading orders
export const tradingOrders = pgTable("trading_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => brokerageAccounts.id),
  snaptradeOrderId: varchar("snaptrade_order_id"),
  symbol: varchar("symbol").notNull(),
  side: varchar("side").notNull(), // BUY, SELL
  orderType: varchar("order_type").notNull(), // Market, Limit
  quantity: decimal("quantity", { precision: 15, scale: 6 }),
  price: decimal("price", { precision: 15, scale: 2 }),
  status: varchar("status").default("PENDING"),
  executedAt: timestamp("executed_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Market data cache
export const marketData = pgTable("market_data", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol").notNull(),
  name: varchar("name").notNull(),
  assetType: varchar("asset_type").notNull(),
  price: decimal("price", { precision: 15, scale: 2 }).notNull(),
  changePercent: decimal("change_percent", { precision: 5, scale: 2 }).notNull(),
  volume: decimal("volume", { precision: 20, scale: 2 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Schema types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertConnectedAccount = typeof connectedAccounts.$inferInsert;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;

export type InsertHolding = typeof holdings.$inferInsert;
export type Holding = typeof holdings.$inferSelect;

export type InsertWatchlistItem = typeof watchlist.$inferInsert;
export type WatchlistItem = typeof watchlist.$inferSelect;

export type InsertTrade = typeof trades.$inferInsert;
export type Trade = typeof trades.$inferSelect;

export type InsertTransfer = typeof transfers.$inferInsert;
export type Transfer = typeof transfers.$inferSelect;

export type InsertActivityLog = typeof activityLog.$inferInsert;
export type ActivityLog = typeof activityLog.$inferSelect;

export type InsertMarketData = typeof marketData.$inferInsert;
export type MarketData = typeof marketData.$inferSelect;

export type BrokerageConnection = typeof brokerageConnections.$inferSelect;
export type InsertBrokerageConnection = typeof brokerageConnections.$inferInsert;
export type BrokerageAccount = typeof brokerageAccounts.$inferSelect;
export type InsertBrokerageAccount = typeof brokerageAccounts.$inferInsert;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof bankAccounts.$inferInsert;
export type TradingOrder = typeof tradingOrders.$inferSelect;
export type InsertTradingOrder = typeof tradingOrders.$inferInsert;

// Insert schemas
export const insertConnectedAccountSchema = createInsertSchema(connectedAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWatchlistItemSchema = createInsertSchema(watchlist).omit({
  id: true,
  createdAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true,
  executedAt: true,
});

export const insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  createdAt: true,
  executedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
});
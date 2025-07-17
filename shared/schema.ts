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
  subscriptionTier: varchar("subscription_tier"), // basic, pro, premium
  subscriptionStatus: varchar("subscription_status"), // active, cancelled, expired
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Connected accounts (banks, brokerages, crypto)
export const connectedAccounts = pgTable("connected_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  accountType: varchar("account_type").notNull(), // bank, brokerage, crypto
  institutionName: varchar("institution_name").notNull(),
  accountName: varchar("account_name").notNull(),
  accountNumber: varchar("account_number"),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  isActive: boolean("is_active").default(true),
  lastSynced: timestamp("last_synced").defaultNow(),
  credentials: jsonb("credentials"), // encrypted API tokens
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
  accountId: integer("account_id").references(() => connectedAccounts.id).notNull(),
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
  fromAccountId: integer("from_account_id").references(() => connectedAccounts.id).notNull(),
  toAccountId: integer("to_account_id").references(() => connectedAccounts.id).notNull(),
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

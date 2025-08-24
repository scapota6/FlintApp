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
  unique,
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
  subscriptionTier: varchar("subscription_tier").default("free"), // free, basic, pro, premium
  subscriptionStatus: varchar("subscription_status").default("active"), // active, cancelled, expired
  isAdmin: boolean("is_admin").default(false),
  isBanned: boolean("is_banned").default(false),
  lastLogin: timestamp("last_login").defaultNow(),
  // SnapTrade credentials moved to separate table
  // snaptradeUserId: varchar("snaptrade_user_id"), // SnapTrade user ID
  // snaptradeUserSecret: varchar("snaptrade_user_secret"), // SnapTrade user secret
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Separate table for SnapTrade credentials with unique constraint
export const snaptradeUsers = pgTable('snaptrade_users', {
  id: serial('id').primaryKey(),
  flintUserId: varchar('flint_user_id').notNull().references(() => users.id),
  snaptradeUserId: varchar('snaptrade_user_id').notNull(),
  snaptradeUserSecret: varchar('snaptrade_user_secret').notNull(),
  connectedAt: timestamp('connected_at').defaultNow(),
  lastSyncAt: timestamp('last_sync_at'),
}, (table) => ({
  uniqueFlintUser: unique().on(table.flintUserId), // Ensure only one SnapTrade user per Flint user
}));

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
  status: varchar("status").default("connected"), // connected, disconnected, expired
  lastSynced: timestamp("last_synced").defaultNow(),
  lastCheckedAt: timestamp("last_checked_at"),
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

// Price alerts table
export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  abovePrice: decimal("above_price", { precision: 10, scale: 2 }),
  belowPrice: decimal("below_price", { precision: 10, scale: 2 }),
  active: boolean("active").default(true).notNull(),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("alerts_user_idx").on(table.userId),
  index("alerts_symbol_idx").on(table.symbol),
  index("alerts_active_idx").on(table.active),
]);

// Alert history for debouncing
export const alertHistory = pgTable("alert_history", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => priceAlerts.id, { onDelete: 'cascade' }),
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
  triggerPrice: decimal("trigger_price", { precision: 10, scale: 2 }).notNull(),
  triggerType: varchar("trigger_type", { length: 10 }).notNull(), // 'above' or 'below'
  notificationSent: boolean("notification_sent").default(false).notNull(),
}, (table) => [
  index("history_alert_idx").on(table.alertId),
  index("history_triggered_idx").on(table.triggeredAt),
]);

// User notification preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  emailAlerts: boolean("email_alerts").default(true).notNull(),
  pushAlerts: boolean("push_alerts").default(true).notNull(),
  quietHoursStart: integer("quiet_hours_start"), // Hour in 24h format (0-23)
  quietHoursEnd: integer("quiet_hours_end"), // Hour in 24h format (0-23)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;
export type PriceAlert = typeof priceAlerts.$inferSelect;
export type InsertPriceAlert = typeof priceAlerts.$inferInsert;
export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertAlertHistory = typeof alertHistory.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

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
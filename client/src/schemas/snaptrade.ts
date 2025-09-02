/**
 * Zod schemas for SnapTrade DTOs
 * These provide runtime validation and type inference for API responses
 */

import { z } from 'zod';

// Base schemas
export const MoneySchema = z.object({
  amount: z.number(),
  currency: z.string()
});

export const KnownErrorCodeSchema = z.enum([
  "SNAPTRADE_NOT_REGISTERED",
  "SNAPTRADE_USER_MISMATCH", 
  "SIGNATURE_INVALID",
  "RATE_LIMITED",
  "CONNECTION_DISABLED"
]);

export const ApiErrorSchema = z.object({
  code: z.union([KnownErrorCodeSchema, z.string()]),
  message: z.string(),
  requestId: z.string().nullable().optional()
});

export const ErrorResponseSchema = z.object({
  error: ApiErrorSchema
});

// User Management
export const SnapTradeUserStatusSchema = z.object({
  isRegistered: z.boolean(),
  userId: z.string().uuid().nullable().optional(),
  userSecret: z.string().nullable().optional(),
  connectedAt: z.string().datetime().nullable().optional(),
  lastSyncAt: z.string().datetime().nullable().optional(),
  rotatedAt: z.string().datetime().nullable().optional()
});

export const SnapTradeUserRegistrationSchema = z.object({
  userId: z.string().uuid(),
  userSecret: z.string(),
  connectedAt: z.string().datetime()
});

// Connection Management
export const ConnectionSchema = z.object({
  id: z.string().uuid(),
  brokerageName: z.string(),
  disabled: z.boolean(),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  lastSyncAt: z.string().datetime().nullable()
});

export const ListConnectionsResponseSchema = z.object({
  connections: z.array(ConnectionSchema)
});

export const RefreshConnectionResponseSchema = z.object({
  refreshed: z.boolean(),
  requestedAt: z.string().datetime()
});

export const DisableConnectionResponseSchema = z.object({
  disabled: z.boolean(),
  disabledAt: z.string().datetime()
});

export const RemoveConnectionResponseSchema = z.object({
  removed: z.boolean()
});

// Account Management
export const AccountSummarySchema = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid(),
  institution: z.string(),
  name: z.string().nullable(),
  numberMasked: z.string().nullable(),
  type: z.string().nullable(),
  status: z.enum(["open", "closed", "archived", "unknown"]),
  currency: z.string(),
  totalBalance: MoneySchema.nullable(),
  lastHoldingsSyncAt: z.string().datetime().nullable()
});

export const ListAccountsResponseSchema = z.object({
  accounts: z.array(AccountSummarySchema)
});

export const AccountDetailsSchema = z.object({
  id: z.string().uuid(),
  institution: z.string(),
  name: z.string().nullable(),
  numberMasked: z.string().nullable(),
  type: z.string().nullable(),
  status: z.enum(["open", "closed", "archived", "unknown"]),
  currency: z.string()
});

export const AccountDetailsResponseSchema = z.object({
  account: AccountDetailsSchema
});

export const AccountBalancesSchema = z.object({
  total: MoneySchema.nullable(),
  cash: MoneySchema.nullable(),
  buyingPower: MoneySchema.nullable(),
  maintenanceExcess: MoneySchema.nullable().optional()
});

export const AccountBalancesResponseSchema = z.object({
  balances: AccountBalancesSchema
});

// Positions & Holdings
export const PositionSchema = z.object({
  symbol: z.string(),
  description: z.string().nullable(),
  quantity: z.number(),
  avgPrice: MoneySchema.nullable(),
  lastPrice: MoneySchema.nullable(),
  marketValue: MoneySchema.nullable(),
  unrealizedPnL: MoneySchema.nullable(),
  unrealizedPnLPercent: z.number().nullable(),
  currency: z.string()
});

export const ListPositionsResponseSchema = z.object({
  positions: z.array(PositionSchema)
});

// Orders
export const OrderSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT", "STOP", "STOP_LIMIT"]),
  timeInForce: z.enum(["DAY", "GTC", "FOK", "IOC"]).nullable(),
  quantity: z.number(),
  price: z.number().nullable(),
  stopPrice: z.number().nullable(),
  limitPrice: z.number().nullable(),
  avgFillPrice: z.number().nullable(),
  filledQuantity: z.number().nullable(),
  status: z.enum(["OPEN", "FILLED", "CANCELLED", "REJECTED", "EXPIRED", "PARTIAL"]),
  placedAt: z.string().datetime(),
  filledAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable()
});

export const ListOrdersResponseSchema = z.object({
  orders: z.array(OrderSchema),
  total: z.number(),
  page: z.number().optional(),
  pageSize: z.number().optional()
});

// Activities
export const ActivitySchema = z.object({
  id: z.string().uuid(),
  date: z.string().datetime(),
  type: z.enum(["TRADE", "DIVIDEND", "INTEREST", "FEE", "TRANSFER", "DEPOSIT", "WITHDRAWAL"]),
  description: z.string(),
  amount: z.number(), // positive credit / negative debit
  currency: z.string(),
  symbol: z.string().nullable(),
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  tradeDate: z.string().datetime().nullable(),
  settlementDate: z.string().datetime().nullable()
});

export const ListActivitiesResponseSchema = z.object({
  activities: z.array(ActivitySchema),
  total: z.number(),
  page: z.number().optional(),
  pageSize: z.number().optional()
});

// Symbol Search
export const SymbolInfoSchema = z.object({
  symbol: z.string(),
  description: z.string().nullable(),
  exchange: z.string().nullable(),
  currency: z.string(),
  tradable: z.boolean(),
  securityType: z.string().nullable()
});

export const SymbolSearchResponseSchema = z.object({
  results: z.array(SymbolInfoSchema),
  query: z.string()
});

// Trading
export const ImpactRequestSchema = z.object({
  accountId: z.string().uuid(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT", "STOP", "STOP_LIMIT"]),
  timeInForce: z.enum(["DAY", "GTC", "FOK", "IOC"]).optional(),
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional()
});

export const ImpactSummaryLineSchema = z.object({
  description: z.string(),
  amount: MoneySchema.nullable()
});

export const ImpactResponseSchema = z.object({
  impactId: z.string().uuid(),
  accepted: z.boolean(),
  estimatedCost: MoneySchema.nullable(),
  estimatedCommissions: MoneySchema.nullable(),
  estimatedFees: MoneySchema.nullable(),
  buyingPowerReduction: MoneySchema.nullable(),
  warnings: z.array(z.string()),
  restrictions: z.array(z.string()),
  lines: z.array(ImpactSummaryLineSchema).optional()
});

export const PlaceOrderRequestSchema = z.object({
  impactId: z.string().uuid()
});

export const PlaceOrderResponseSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["submitted", "filled", "partial_filled", "replaced", "rejected"]),
  submittedAt: z.string().datetime()
});

// Export type inference
export type Money = z.infer<typeof MoneySchema>;
export type KnownErrorCode = z.infer<typeof KnownErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SnapTradeUserStatus = z.infer<typeof SnapTradeUserStatusSchema>;
export type SnapTradeUserRegistration = z.infer<typeof SnapTradeUserRegistrationSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type ListConnectionsResponse = z.infer<typeof ListConnectionsResponseSchema>;
export type RefreshConnectionResponse = z.infer<typeof RefreshConnectionResponseSchema>;
export type DisableConnectionResponse = z.infer<typeof DisableConnectionResponseSchema>;
export type RemoveConnectionResponse = z.infer<typeof RemoveConnectionResponseSchema>;
export type AccountSummary = z.infer<typeof AccountSummarySchema>;
export type ListAccountsResponse = z.infer<typeof ListAccountsResponseSchema>;
export type AccountDetails = z.infer<typeof AccountDetailsSchema>;
export type AccountDetailsResponse = z.infer<typeof AccountDetailsResponseSchema>;
export type AccountBalances = z.infer<typeof AccountBalancesSchema>;
export type AccountBalancesResponse = z.infer<typeof AccountBalancesResponseSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type ListPositionsResponse = z.infer<typeof ListPositionsResponseSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type ListOrdersResponse = z.infer<typeof ListOrdersResponseSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type ListActivitiesResponse = z.infer<typeof ListActivitiesResponseSchema>;
export type SymbolInfo = z.infer<typeof SymbolInfoSchema>;
export type SymbolSearchResponse = z.infer<typeof SymbolSearchResponseSchema>;
export type ImpactRequest = z.infer<typeof ImpactRequestSchema>;
export type ImpactSummaryLine = z.infer<typeof ImpactSummaryLineSchema>;
export type ImpactResponse = z.infer<typeof ImpactResponseSchema>;
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;
export type PlaceOrderResponse = z.infer<typeof PlaceOrderResponseSchema>;
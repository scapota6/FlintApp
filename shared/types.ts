/**
 * Normalized API contracts for Flint's backend
 * These DTOs provide stable interfaces for the React app,
 * normalized from SnapTrade's objects but consistent for UI components
 */

// Common types
export type ISODate = string;        // e.g. "2025-08-24T14:20:01Z"
export type UUID = string;           // SnapTrade IDs / authorization IDs
export interface Money {
  amount: number;
  currency: string;
}

// Known error codes the frontend should handle
export type KnownErrorCode =
  | "SNAPTRADE_NOT_REGISTERED"   // 428 → call /users/register then retry
  | "SNAPTRADE_USER_MISMATCH"    // 409 → clear stored userSecret and re-register
  | "SIGNATURE_INVALID"          // 401 (SnapTrade 1076) → server keys/clock/SDK
  | "RATE_LIMITED"               // 429 → show "Please try again in a moment"
  | "CONNECTION_DISABLED"        // 409 → show Reconnect CTA
  | "UNKNOWN";

// Standard error envelope for all 4xx/5xx responses
export interface ApiError {
  code: KnownErrorCode | string; // Known codes + any additional ones
  message: string;               // human-friendly
  requestId?: string | null;     // X-Request-ID from SnapTrade
}

export interface ErrorResponse {
  error: ApiError;
}

// User Management
export interface SnapTradeUserStatus {
  isRegistered: boolean;
  userId?: UUID | null;
  userSecret?: string | null;
  connectedAt?: ISODate | null;
  lastSyncAt?: ISODate | null;
  rotatedAt?: ISODate | null;
}

export interface SnapTradeUserRegistration {
  userId: UUID;
  userSecret: string;
  connectedAt: ISODate;
}

// Connection Management
export interface Connection {
  id: UUID;                      // brokerage_authorization.id
  brokerageName: string;
  disabled: boolean;
  createdAt: ISODate | null;
  updatedAt: ISODate | null;
  lastSyncAt: ISODate | null;
}

export interface ListConnectionsResponse {
  connections: Connection[];
}

export interface RefreshConnectionResponse {
  refreshed: boolean;
  requestedAt: ISODate;
}

export interface DisableConnectionResponse {
  disabled: boolean;
  disabledAt: ISODate;
}

export interface RemoveConnectionResponse {
  removed: boolean;
}

export interface AccountSummary {
  id: UUID;                        // SnapTrade account id
  connectionId: UUID;              // brokerage authorization id
  institution: string;
  name: string | null;             // account display name
  numberMasked: string | null;
  type: string | null;             // e.g., "individual", "margin", etc.
  status: "open" | "closed" | "archived" | "unknown";
  currency: string;                // base currency
  totalBalance: Money | null;      // from balances
  lastHoldingsSyncAt: ISODate | null;
}

export interface ListAccountsResponse {
  accounts: AccountSummary[];
}

export interface AccountDetails {
  id: UUID;
  institution: string;
  name: string | null;
  numberMasked: string | null;
  type: string | null;
  status: "open" | "closed" | "archived" | "unknown";
  currency: string;
}

export interface AccountDetailsResponse {
  account: AccountDetails;
}

export interface AccountBalances {
  total: Money | null;         // total account equity
  cash: Money | null;          // cash available
  buyingPower: Money | null;   // if margin
  maintenanceExcess: Money | null | undefined;
}

export interface AccountBalancesResponse {
  balances: AccountBalances;
}

export interface Position {
  symbol: string;            // e.g., "AAPL"
  description: string | null;
  quantity: number;          // positive long / negative short
  avgPrice: Money | null;    // cost basis per share
  marketPrice: Money | null;
  marketValue: Money | null; // quantity * marketPrice
  unrealizedPnl: Money | null;
  currency: string;          // trading currency
}

export interface PositionsResponse {
  accountId: UUID;
  positions: Position[];
  asOf: ISODate | null;
}

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type TimeInForce = "day" | "gtc" | "fok" | "ioc";

export interface Order {
  id: string;
  placedAt?: ISODate | null; // Made optional for compatibility
  status: "open" | "filled" | "cancelled" | "rejected" | "partial_filled" | "unknown";
  side: OrderSide;
  type: OrderType;
  timeInForce: TimeInForce | null;
  symbol: string | null;
  symbolId?: string | null;
  quantity: number;
  price?: number | null;
  limitPrice?: Money | null; // Made optional for compatibility
  averageFillPrice?: Money | null; // Made optional for compatibility
  filledQuantity?: number;
  filledPrice?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  accountId?: string;
}

export interface OrdersResponse {
  orders: Order[];
}

export type ActivityType = "trade" | "dividend" | "interest" | "fee" | "transfer";

export interface Activity {
  id: string;
  date?: ISODate; // Made optional for compatibility
  tradeDate?: string | null;
  settlementDate?: string | null;
  type: ActivityType;
  description: string | null;
  amount: Money;             // positive credit / negative debit
  symbol: string | null;
  symbolId?: string | null;
  quantity?: number;
  price?: number | null;
  currency?: string;
  accountId?: string;
}

export interface ActivitiesResponse {
  activities: Activity[];
}

export interface OptionHolding {
  symbol: string;          // OCC symbol, e.g., "AAPL  240920C00200000"
  description: string | null;
  quantity: number;
  marketPrice: Money | null;
  marketValue: Money | null;
  unrealizedPnl: Money | null;
}

export interface OptionHoldingsResponse {
  holdings: OptionHolding[];
}

export interface SymbolInfo {
  symbol: string;            // "AAPL"
  description: string;       // "Apple Inc."
  exchange: string | null;   // "NASDAQ"
  currency: string;          // "USD"
  tradable: boolean;
  securityType: string;      // "EQUITY", etc.
}

export interface SymbolSearchResponse {
  results: SymbolInfo[];
}

export interface ImpactRequest {
  accountId: UUID;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;              // shares
  type: OrderType;
  timeInForce?: TimeInForce;
  limitPrice?: number;           // for limit/stop_limit
  stopPrice?: number;            // for stop/stop_limit
}

export interface ImpactSummaryLine {
  label: string;
  value: string;
}

export interface ImpactResponse {
  impactId: string;              // returned by SnapTrade impact call
  accepted: boolean;             // false if broker would reject
  reason: string | null;         // rejection reason if any
  estCost: Money | null;         // or proceeds if sell
  lines: ImpactSummaryLine[];    // fee/tax/settlement lines
}

export interface PlaceOrderRequest {
  impactId: string;
}

export interface PlaceOrderResponse {
  orderId: string;
  status: "submitted" | "filled" | "partial_filled" | "replaced" | "rejected";
  submittedAt: ISODate | null;
}

export type WebhookType =
  | "connection.attempted"
  | "connection.added"
  | "connection.updated"
  | "connection.deleted"
  | "connection.broken"
  | "connection.fixed";

export interface WebhookEvent {
  id: string;
  type: WebhookType;
  createdAt: ISODate;
  userId: string;               // your Flint user id echoed back
  authorizationId?: UUID | null;
  details?: Record<string, any>;
}

export interface WebhookAck {
  ok: true;
}

export interface BrokerageConnection {
  id: UUID;                           // brokerage_authorization_id
  name: string;                       // e.g., "Robinhood"
  type: string;                       // e.g., "read"
  isActive: boolean;
  connectedAt: ISODate;
  lastSyncAt?: ISODate | null;
  disabled?: boolean | null;
  disabledDate?: ISODate | null;
  meta?: Record<string, any> | null;
}

export interface PortalUrlRequest {
  reconnectAuthorizationId?: UUID | null; // SnapTrade brokerage_authorization.id
  redirectUriOverride?: string | null;    // normally omitted
}

export interface PortalUrlResponse {
  url: string;
}

export interface ConnectionRedirectUrl {
  redirectUrl: string;
  sessionId?: string | null;
}

// Account Management
export interface AccountSummary {
  id: UUID;
  brokerageAuthId: UUID;             // brokerage_authorization
  institutionName: string;           // e.g., "Robinhood"
  name: string;                      // e.g., "Robinhood Individual"
  numberMasked?: string | null;      // e.g., "***2900"
  accountType?: string | null;       // e.g., "margin", "cash"
  status?: string | null;            // e.g., "ACTIVE"
  currency: string;                  // default "USD"
  balance?: Money | null;
  lastSyncAt?: ISODate | null;
}

export interface AccountDetails extends AccountSummary {
  createdDate?: ISODate | null;
  cashRestrictions?: string[] | null;
  meta?: Record<string, any> | null;
  syncStatus?: {
    holdings?: {
      lastSuccessfulSync?: ISODate | null;
      initialSyncCompleted?: boolean | null;
    } | null;
    transactions?: {
      lastSuccessfulSync?: ISODate | null;
      firstTransactionDate?: ISODate | null;
      initialSyncCompleted?: boolean | null;
    } | null;
  } | null;
}

// Balance Management
export interface AccountBalance {
  accountId: UUID;
  total?: Money | null;
  cash?: Money | null;
  buying_power?: Money | null;
  withdrawable?: Money | null;
  lastUpdated?: ISODate | null;
}

// SnapTrade enhanced types
export interface Account {
  id: string;
  name: string;
  number: string | null;
  institutionName: string | null;
  brokerageAuthorizationId: string | null;
  accountType: string | null;
  status: string | null;
  balance: {
    total: number;
    currency: string;
  };
  syncStatus: {
    holdingsLastSync: string | null;
    transactionsLastSync: string | null;
    initialSyncCompleted: boolean;
  };
  createdAt: string | null;
  rawType: string | null;
  cashRestrictions: string[];
  meta?: any;
}

export interface Holding {
  symbol: string | null;
  symbolId: string | null;
  description: string | null;
  quantity: number;
  averagePrice: number;
  price: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  currency: string;
  accountId: string;
  accountName?: string | null;
  institutionName?: string | null;
}

// Position Management
export interface Position {
  symbol: string | null;                    // e.g., "AAPL"
  symbolId?: string | null;
  description?: string | null;
  quantity: number;
  averagePrice?: number;
  price?: number;
  avgPrice: Money | null;    // Required by existing type
  marketPrice: Money | null; // Required by existing type
  marketValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
  currency: string;
  accountId?: string;
  currentPrice?: number | null;
  costBasis?: Money | null;
  unrealizedPnL?: Money | null;
  unrealizedPnLPercent?: number | null;
  lastUpdated?: ISODate | null;
}

export interface AccountPositions {
  accountId: UUID;
  positions: Position[];
  lastUpdated?: ISODate | null;
}

export interface AccountOrders {
  accountId: UUID;
  orders: Order[];
  lastUpdated?: ISODate | null;
}

export interface AccountActivities {
  accountId: UUID;
  activities: Activity[];
  lastUpdated?: ISODate | null;
}

// Trading Management
export interface TradeRequest {
  accountId: UUID;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  type: 'MARKET' | 'LIMIT';
  price?: number | null;              // required for LIMIT orders
  timeInForce?: 'DAY' | 'GTC' | null;
}

export interface TradePreview {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  estimatedPrice?: number | null;
  estimatedTotal?: Money | null;
  estimatedFees?: Money | null;
  buyingPower?: Money | null;
  impact?: string | null;             // e.g., "LOW", "MEDIUM", "HIGH"
  warnings?: string[] | null;
}

export interface TradeConfirmation {
  orderId: UUID;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  type: 'MARKET' | 'LIMIT';
  status: 'PENDING' | 'FILLED' | 'REJECTED';
  placedAt: ISODate;
  estimatedFillPrice?: number | null;
}

// Instrument Search
export interface InstrumentSearchResult {
  symbol: string;
  description: string;
  exchange?: string | null;
  type?: string | null;              // e.g., "stock", "etf", "crypto"
  currency?: string | null;
}

// Holdings Summary
export interface HoldingsSummary {
  accountId: UUID;
  totalValue: Money;
  cashValue?: Money | null;
  equityValue?: Money | null;
  dayChange?: Money | null;
  dayChangePercent?: number | null;
  positions: Position[];
  lastUpdated?: ISODate | null;
}

// API Response wrappers
export interface ListResponse<T> {
  data: T[];
  total?: number | null;
  lastUpdated?: ISODate | null;
}

export interface DetailsResponse<T> {
  data: T;
  lastUpdated?: ISODate | null;
}
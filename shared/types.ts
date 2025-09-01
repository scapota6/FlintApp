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

// Standard error envelope for all 4xx/5xx responses
export interface ApiError {
  code: string;               // e.g., "SNAPTRADE_NOT_REGISTERED"
  message: string;            // human-friendly
  requestId?: string | null;  // X-Request-ID from SnapTrade
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
  placedAt: ISODate | null;
  status: "open" | "filled" | "cancelled" | "rejected" | "partial_filled" | "unknown";
  side: OrderSide;
  type: OrderType;
  timeInForce: TimeInForce | null;
  symbol: string;
  quantity: number;
  limitPrice: Money | null;
  averageFillPrice: Money | null;
}

export interface OrdersResponse {
  orders: Order[];
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

// Position Management
export interface Position {
  symbol: string;                    // e.g., "AAPL"
  description?: string | null;       // e.g., "Apple Inc"
  quantity: number;
  averagePrice?: number | null;
  currentPrice?: number | null;
  marketValue?: Money | null;
  costBasis?: Money | null;
  unrealizedPnL?: Money | null;
  unrealizedPnLPercent?: number | null;
  currency: string;
  lastUpdated?: ISODate | null;
}

export interface AccountPositions {
  accountId: UUID;
  positions: Position[];
  lastUpdated?: ISODate | null;
}

// Order Management
export interface Order {
  id: UUID;
  accountId: UUID;
  symbol: string;
  side: 'BUY' | 'SELL';               // normalized
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT'; // normalized
  quantity: number;
  price?: number | null;              // for limit orders
  stopPrice?: number | null;          // for stop orders
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED'; // normalized
  timeInForce?: 'DAY' | 'GTC' | 'IOC' | 'FOK' | null;
  filledQuantity?: number | null;
  avgFillPrice?: number | null;
  fees?: Money | null;
  placedAt: ISODate;
  filledAt?: ISODate | null;
  cancelledAt?: ISODate | null;
}

export interface AccountOrders {
  accountId: UUID;
  orders: Order[];
  lastUpdated?: ISODate | null;
}

// Activity Management  
export interface Activity {
  id: UUID;
  accountId: UUID;
  type: 'TRADE' | 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'FEE' | 'OTHER'; // normalized
  symbol?: string | null;
  quantity?: number | null;
  price?: number | null;
  amount?: Money | null;
  fees?: Money | null;
  description: string;
  date: ISODate;
  settleDate?: ISODate | null;
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
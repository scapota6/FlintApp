/**
 * SnapTrade adapter for transforming raw SnapTrade API responses
 * to normalized DTOs that conform to our Zod schemas
 */

import type {
  SnapTradeUserStatus,
  SnapTradeUserRegistration,
  Connection,
  AccountSummary,
  AccountDetails,
  AccountBalances,
  Position,
  Order,
  Activity,
  SymbolInfo,
  Money
} from '../schemas/snaptrade';

/**
 * Transform raw SnapTrade user data to SnapTradeUserStatus
 */
export function adaptSnapTradeUserStatus(rawUser: any): SnapTradeUserStatus {
  return {
    isRegistered: !!rawUser?.userId,
    userId: rawUser?.userId || null,
    userSecret: rawUser?.userSecret || null,
    connectedAt: rawUser?.createdAt || null,
    lastSyncAt: rawUser?.lastSyncAt || null,
    rotatedAt: rawUser?.rotatedAt || null
  };
}

/**
 * Transform raw SnapTrade user registration response to SnapTradeUserRegistration
 */
export function adaptSnapTradeUserRegistration(rawRegistration: any): SnapTradeUserRegistration {
  return {
    userId: rawRegistration.userId,
    userSecret: rawRegistration.userSecret,
    connectedAt: rawRegistration.createdAt || new Date().toISOString()
  };
}

/**
 * Transform raw SnapTrade brokerage authorization to Connection
 */
export function adaptConnection(rawAuth: any): Connection {
  return {
    id: rawAuth.id,
    brokerageName: rawAuth.brokerage?.name || rawAuth.name || 'Unknown Brokerage',
    disabled: rawAuth.disabled === true,
    createdAt: rawAuth.created_date || rawAuth.createdAt || null,
    updatedAt: rawAuth.updated_date || rawAuth.updatedAt || null,
    lastSyncAt: rawAuth.last_sync_at || rawAuth.lastSyncAt || null
  };
}

/**
 * Transform raw SnapTrade account to AccountSummary
 */
export function adaptAccountSummary(rawAccount: any): AccountSummary {
  const balance = rawAccount.balance?.total || rawAccount.totalBalance;
  
  return {
    id: rawAccount.id,
    connectionId: rawAccount.brokerage_authorization || rawAccount.connectionId,
    institution: rawAccount.institution_name || rawAccount.institution || 'Unknown',
    name: rawAccount.name || null,
    numberMasked: rawAccount.number || rawAccount.numberMasked || null,
    type: rawAccount.meta?.type || rawAccount.type || rawAccount.raw_type || null,
    status: mapAccountStatus(rawAccount.status),
    currency: rawAccount.currency || balance?.currency || 'USD',
    totalBalance: balance ? adaptMoney(balance) : null,
    lastHoldingsSyncAt: rawAccount.sync_status?.holdings?.last_successful_sync || 
                       rawAccount.lastHoldingsSyncAt || null
  };
}

/**
 * Transform raw SnapTrade account to AccountDetails
 */
export function adaptAccountDetails(rawAccount: any): AccountDetails {
  return {
    id: rawAccount.id,
    institution: rawAccount.institution_name || rawAccount.institution || 'Unknown',
    name: rawAccount.name || null,
    numberMasked: rawAccount.number || rawAccount.numberMasked || null,
    type: rawAccount.meta?.type || rawAccount.type || rawAccount.raw_type || null,
    status: mapAccountStatus(rawAccount.status),
    currency: rawAccount.currency || 'USD'
  };
}

/**
 * Transform raw SnapTrade balances to AccountBalances
 */
export function adaptAccountBalances(rawBalances: any): AccountBalances {
  return {
    total: rawBalances.total ? adaptMoney(rawBalances.total) : null,
    cash: rawBalances.cash ? adaptMoney(rawBalances.cash) : null,
    buyingPower: rawBalances.buying_power || rawBalances.buyingPower ? 
                 adaptMoney(rawBalances.buying_power || rawBalances.buyingPower) : null,
    maintenanceExcess: rawBalances.maintenance_excess || rawBalances.maintenanceExcess ? 
                      adaptMoney(rawBalances.maintenance_excess || rawBalances.maintenanceExcess) : null
  };
}

/**
 * Transform raw SnapTrade position to Position
 */
export function adaptPosition(rawPosition: any): Position {
  return {
    symbol: rawPosition.symbol || rawPosition.instrument?.symbol || '',
    description: rawPosition.description || 
                rawPosition.instrument?.description || 
                rawPosition.instrument?.name || null,
    quantity: parseFloat(rawPosition.quantity || rawPosition.units || '0'),
    avgPrice: rawPosition.average_purchase_price || rawPosition.avgPrice ? 
             adaptMoney(rawPosition.average_purchase_price || rawPosition.avgPrice) : null,
    lastPrice: rawPosition.price || rawPosition.lastPrice ? 
              adaptMoney(rawPosition.price || rawPosition.lastPrice) : null,
    marketValue: rawPosition.market_value || rawPosition.marketValue ? 
                adaptMoney(rawPosition.market_value || rawPosition.marketValue) : null,
    unrealizedPnL: rawPosition.unrealized_pnl || rawPosition.unrealizedPnL ? 
                  adaptMoney(rawPosition.unrealized_pnl || rawPosition.unrealizedPnL) : null,
    unrealizedPnLPercent: rawPosition.unrealized_pnl_percent || 
                         rawPosition.unrealizedPnLPercent || null,
    currency: rawPosition.currency?.code || rawPosition.currency || 'USD'
  };
}

/**
 * Transform raw SnapTrade order to Order
 */
export function adaptOrder(rawOrder: any): Order {
  return {
    id: rawOrder.id,
    symbol: rawOrder.symbol || rawOrder.instrument?.symbol || '',
    side: rawOrder.side?.toUpperCase() || 'BUY',
    type: rawOrder.type?.toUpperCase() || 'MARKET',
    timeInForce: rawOrder.time_in_force?.toUpperCase() || rawOrder.timeInForce?.toUpperCase() || null,
    quantity: parseFloat(rawOrder.quantity || rawOrder.units || '0'),
    price: rawOrder.price ? parseFloat(rawOrder.price) : null,
    stopPrice: rawOrder.stop_price ? parseFloat(rawOrder.stop_price) : null,
    limitPrice: rawOrder.limit_price ? parseFloat(rawOrder.limit_price) : null,
    avgFillPrice: rawOrder.avg_fill_price ? parseFloat(rawOrder.avg_fill_price) : null,
    filledQuantity: rawOrder.filled_quantity ? parseFloat(rawOrder.filled_quantity) : null,
    status: mapOrderStatus(rawOrder.status),
    placedAt: rawOrder.placed_at || rawOrder.created_at || new Date().toISOString(),
    filledAt: rawOrder.filled_at || null,
    cancelledAt: rawOrder.cancelled_at || null
  };
}

/**
 * Transform raw SnapTrade activity to Activity
 */
export function adaptActivity(rawActivity: any): Activity {
  return {
    id: rawActivity.id,
    date: rawActivity.date || rawActivity.transaction_date || rawActivity.createdAt,
    type: mapActivityType(rawActivity.type),
    description: rawActivity.description || 
                rawActivity.memo || 
                `${rawActivity.type || 'Transaction'} - ${rawActivity.symbol || ''}`.trim(),
    amount: parseFloat(rawActivity.amount || rawActivity.net_amount || '0'),
    currency: rawActivity.currency?.code || rawActivity.currency || 'USD',
    symbol: rawActivity.symbol || rawActivity.instrument?.symbol || null,
    quantity: rawActivity.quantity ? parseFloat(rawActivity.quantity) : null,
    price: rawActivity.price ? parseFloat(rawActivity.price) : null,
    tradeDate: rawActivity.trade_date || null,
    settlementDate: rawActivity.settlement_date || null
  };
}

/**
 * Transform raw SnapTrade symbol to SymbolInfo
 */
export function adaptSymbolInfo(rawSymbol: any): SymbolInfo {
  return {
    symbol: rawSymbol.symbol || rawSymbol.raw_symbol || '',
    description: rawSymbol.description || rawSymbol.name || null,
    exchange: rawSymbol.exchange?.name || rawSymbol.exchange || null,
    currency: rawSymbol.currency?.code || rawSymbol.currency || 'USD',
    tradable: rawSymbol.is_tradable !== false, // default to true
    securityType: rawSymbol.type?.description || 
                 rawSymbol.security_type || 
                 rawSymbol.type || null
  };
}

/**
 * Transform raw money object to Money DTO
 */
export function adaptMoney(rawMoney: any): Money {
  if (typeof rawMoney === 'number') {
    return { amount: rawMoney, currency: 'USD' };
  }
  
  return {
    amount: parseFloat(rawMoney.amount || rawMoney.value || '0'),
    currency: rawMoney.currency?.code || rawMoney.currency || 'USD'
  };
}

/**
 * Map SnapTrade account status to normalized status
 */
function mapAccountStatus(status: any): "open" | "closed" | "archived" | "unknown" {
  if (!status) return "unknown";
  
  const statusStr = status.toString().toLowerCase();
  
  if (statusStr.includes('active') || statusStr.includes('open')) return "open";
  if (statusStr.includes('closed') || statusStr.includes('inactive')) return "closed";
  if (statusStr.includes('archived')) return "archived";
  
  return "unknown";
}

/**
 * Map SnapTrade order status to normalized status
 */
function mapOrderStatus(status: any): "OPEN" | "FILLED" | "CANCELLED" | "REJECTED" | "EXPIRED" | "PARTIAL" {
  if (!status) return "OPEN";
  
  const statusStr = status.toString().toUpperCase();
  
  switch (statusStr) {
    case 'NEW':
    case 'PENDING':
    case 'SUBMITTED':
      return "OPEN";
    case 'FILLED':
    case 'EXECUTED':
      return "FILLED";
    case 'PARTIALLY_FILLED':
    case 'PARTIAL_FILLED':
      return "PARTIAL";
    case 'CANCELLED':
    case 'CANCELED':
      return "CANCELLED";
    case 'REJECTED':
      return "REJECTED";
    case 'EXPIRED':
      return "EXPIRED";
    default:
      return "OPEN";
  }
}

/**
 * Map SnapTrade activity type to normalized type
 */
function mapActivityType(type: any): "TRADE" | "DIVIDEND" | "INTEREST" | "FEE" | "TRANSFER" | "DEPOSIT" | "WITHDRAWAL" {
  if (!type) return "TRADE";
  
  const typeStr = type.toString().toUpperCase();
  
  if (typeStr.includes('BUY') || typeStr.includes('SELL') || typeStr.includes('TRADE')) return "TRADE";
  if (typeStr.includes('DIVIDEND')) return "DIVIDEND";
  if (typeStr.includes('INTEREST')) return "INTEREST";
  if (typeStr.includes('FEE') || typeStr.includes('COMMISSION')) return "FEE";
  if (typeStr.includes('TRANSFER')) return "TRANSFER";
  if (typeStr.includes('DEPOSIT')) return "DEPOSIT";
  if (typeStr.includes('WITHDRAWAL')) return "WITHDRAWAL";
  
  return "TRADE";
}
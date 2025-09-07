/**
 * SnapTrade Account Selection Utilities
 * Based on official SnapTrade CLI patterns for smart account filtering
 */

import { logger } from "@shared/logger";

// Broker capabilities based on SnapTrade CLI
const BROKERS_WITH_MLEG_OPTIONS = [
  "WEBULL",
  "SCHWAB", 
  "TASTYTRADE",
  "ETRADE",
  "ALPACA",
  "ALPACA-PAPER",
];

const BROKERS_WITH_CRYPTO = [
  "COINBASE",
  "BINANCE", 
  "KRAKEN"
];

export type TradingContext = "option_trade" | "equity_trade" | "crypto_trade" | null;

export interface AccountSelectionOptions {
  context?: TradingContext;
  preferLastUsed?: boolean;
  filterDisabled?: boolean;
}

export interface BrokerageAccount {
  id: string;
  name: string;
  institutionName: string;
  balance?: {
    total?: {
      amount: number;
      currency: string;
    };
  };
  brokerageAuthorization: string;
  disabled?: boolean;
  type?: string;
}

export interface BrokerageConnection {
  id: string;
  brokerage: {
    name: string;
    slug: string;
  };
  disabled: boolean;
  type: "read" | "trade";
}

export interface AccountWithReason extends Omit<BrokerageAccount, 'disabled'> {
  disabled?: boolean | string; // Can be boolean or reason string
  connectionDisabled?: boolean;
  readOnly?: boolean;
}

/**
 * Filter accounts based on trading context and broker capabilities
 * Follows SnapTrade CLI filtering logic exactly
 */
export function filterAccountsForContext(
  accounts: BrokerageAccount[], 
  connections: BrokerageConnection[],
  context?: TradingContext
): AccountWithReason[] {
  const connectionMap = new Map(connections.map(conn => [conn.id, conn]));
  
  return accounts.map(account => {
    const connection = connectionMap.get(account.brokerageAuthorization);
    const result: AccountWithReason = { ...account };
    
    if (!connection) {
      result.disabled = "Connection not found";
      return result;
    }
    
    // If there's no context, all accounts are valid
    if (!context) {
      result.disabled = false;
      return result;
    }
    
    // If trying to trade, check if the connection is disabled or read-only
    if (context === "equity_trade" || context === "option_trade") {
      if (connection.disabled) {
        result.disabled = "Connection disabled";
        result.connectionDisabled = true;
        return result;
      }
      
      if (connection.type === "read") {
        result.disabled = "Read-only connection";
        result.readOnly = true;
        return result;
      }
    }
    
    // For options, check if the brokerage supports multi-leg options
    if (context === "option_trade") {
      if (!BROKERS_WITH_MLEG_OPTIONS.includes(connection.brokerage.slug)) {
        result.disabled = "Option trading not supported";
        return result;
      }
    }
    
    // For crypto, check if the brokerage supports crypto trading
    if (context === "crypto_trade") {
      if (!BROKERS_WITH_CRYPTO.includes(connection.brokerage.slug)) {
        result.disabled = "Crypto trading not supported";
        return result;
      }
    }
    
    // No issues, account is selectable
    result.disabled = false;
    return result;
  });
}

/**
 * Group accounts by brokerage connection
 * Matches SnapTrade CLI organization pattern
 */
export function groupAccountsByConnection(
  accounts: BrokerageAccount[],
  connections: BrokerageConnection[]
): Record<string, { connection: BrokerageConnection; accounts: BrokerageAccount[] }> {
  const connectionMap = new Map(connections.map(conn => [conn.id, conn]));
  const grouped: Record<string, { connection: BrokerageConnection; accounts: BrokerageAccount[] }> = {};
  
  for (const account of accounts) {
    const connection = connectionMap.get(account.brokerageAuthorization);
    if (connection) {
      if (!grouped[connection.id]) {
        grouped[connection.id] = { connection, accounts: [] };
      }
      grouped[connection.id].accounts.push(account);
    }
  }
  
  return grouped;
}

/**
 * Get the best account for a given context
 * Prefers accounts with higher balances and better capabilities
 */
export function selectBestAccount(
  accounts: AccountWithReason[],
  context?: TradingContext
): AccountWithReason | null {
  // Filter out disabled accounts
  const availableAccounts = accounts.filter(acc => !acc.disabled);
  
  if (availableAccounts.length === 0) {
    logger.warn("No available accounts for context", { metadata: { context } });
    return null;
  }
  
  // Sort by total balance (highest first)
  const sortedAccounts = availableAccounts.sort((a, b) => {
    const balanceA = a.balance?.total?.amount || 0;
    const balanceB = b.balance?.total?.amount || 0;
    return balanceB - balanceA;
  });
  
  // Return the account with the highest balance
  return sortedAccounts[0];
}

/**
 * Check if a brokerage supports a specific trading context
 */
export function brokerSupportsContext(brokerSlug: string, context: TradingContext): boolean {
  if (!context) return true;
  
  switch (context) {
    case "option_trade":
      return BROKERS_WITH_MLEG_OPTIONS.includes(brokerSlug);
    case "crypto_trade":
      return BROKERS_WITH_CRYPTO.includes(brokerSlug);
    case "equity_trade":
      return true; // All brokers support equity trading
    default:
      return true;
  }
}

/**
 * Get account availability stats for admin dashboard
 */
export function getAccountStats(
  accounts: BrokerageAccount[],
  connections: BrokerageConnection[]
): {
  totalAccounts: number;
  activeAccounts: number;
  readOnlyAccounts: number;
  disabledAccounts: number;
  tradingCapable: number;
  optionsCapable: number;
  cryptoCapable: number;
} {
  const filtered = filterAccountsForContext(accounts, connections);
  
  return {
    totalAccounts: accounts.length,
    activeAccounts: filtered.filter(acc => !acc.disabled).length,
    readOnlyAccounts: filtered.filter(acc => acc.readOnly).length,
    disabledAccounts: filtered.filter(acc => acc.connectionDisabled).length,
    tradingCapable: filterAccountsForContext(accounts, connections, "equity_trade")
      .filter(acc => !acc.disabled).length,
    optionsCapable: filterAccountsForContext(accounts, connections, "option_trade")
      .filter(acc => !acc.disabled).length,
    cryptoCapable: filterAccountsForContext(accounts, connections, "crypto_trade")
      .filter(acc => !acc.disabled).length,
  };
}
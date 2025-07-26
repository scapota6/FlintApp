import { apiRequest } from "./queryClient";

export interface SnapTradeAccount {
  id: string;
  name: string;
  type: string;
  institution: string;
  balance: number;
  currency: string;
  connection_id: string;
}

export interface SnapTradeHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  market_value: number;
  type: string;
  account_id: string;
}

export interface SnapTradeQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
}

export interface SnapTradeOrder {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT';
  status: string;
  account_id: string;
}

export class SnapTradeAPI {
  static async getConnectionUrl(): Promise<{ url: string }> {
    console.log('SnapTrade: Requesting connection URL from unified register endpoint...');
    const response = await apiRequest("POST", "/api/snaptrade/register");
    const data = await response.json();
    console.log('SnapTrade: Received connection URL response:', data);
    return data;
  }

  static async getAccounts(): Promise<SnapTradeAccount[]> {
    const response = await apiRequest("GET", "/api/snaptrade/accounts");
    return response.json();
  }

  static async getHoldings(accountId?: string): Promise<SnapTradeHolding[]> {
    const url = accountId ? `/api/snaptrade/holdings?accountId=${accountId}` : "/api/snaptrade/holdings";
    const response = await apiRequest("GET", url);
    return response.json();
  }

  static async getAllHoldings(): Promise<SnapTradeHolding[]> {
    try {
      // Get all accounts first
      const accounts = await this.getAccounts();
      
      if (!accounts.length) {
        return []; // No accounts, return empty holdings
      }

      // Get holdings for each account
      const allHoldings: SnapTradeHolding[] = [];
      for (const account of accounts) {
        try {
          const holdings = await this.getHoldings(account.id);
          allHoldings.push(...holdings);
        } catch (err) {
          console.warn(`Failed to get holdings for account ${account.id}:`, err);
          // Continue with other accounts
        }
      }
      
      return allHoldings;
    } catch (err) {
      console.error('Failed to get all holdings:', err);
      return []; // Return empty array instead of throwing
    }
  }

  static async searchSymbols(query: string): Promise<SnapTradeQuote[]> {
    const response = await apiRequest("GET", `/api/snaptrade/search?q=${encodeURIComponent(query)}`);
    return response.json();
  }

  static async getQuote(symbol: string): Promise<SnapTradeQuote> {
    const response = await apiRequest("GET", `/api/snaptrade/quote/${symbol}`);
    return response.json();
  }

  static async placeOrder(orderData: {
    accountId: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    orderType: 'MARKET' | 'LIMIT';
  }): Promise<SnapTradeOrder> {
    const response = await apiRequest("POST", "/api/snaptrade/orders", orderData);
    return response.json();
  }

  static async getOrders(accountId?: string): Promise<SnapTradeOrder[]> {
    const url = accountId ? `/api/snaptrade/orders/${accountId}` : "/api/snaptrade/orders";
    const response = await apiRequest("GET", url);
    return response.json();
  }

  static async disconnectAccount(accountId: string) {
    const response = await apiRequest("DELETE", `/api/snaptrade/accounts/${accountId}`);
    return response.json();
  }
}
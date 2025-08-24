import { apiRequest } from "./queryClient";

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
}

export interface DashboardData {
  totalBalance: number;
  bankBalance: number;
  investmentBalance: number;
  accounts: any[];
  holdings: any[];
  watchlist: any[];
  recentTrades: any[];
  recentTransfers: any[];
  recentActivity: any[];
  snapTradeStatus?: {
    error?: 'not_connected' | 'auth_failed' | 'fetch_failed';
    connected?: boolean;
  };
}

export class FinancialAPI {
  static async getDashboardData(): Promise<DashboardData> {
    const response = await apiRequest("/api/dashboard");
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async getMarketData(symbol: string): Promise<MarketData> {
    const response = await apiRequest(`/api/market/${symbol}`);
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async getAccounts() {
    const response = await apiRequest("/api/accounts");
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async connectAccount(accountData: any) {
    const response = await apiRequest("/api/accounts", { method: "POST", body: JSON.stringify(accountData) });
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async getWatchlist() {
    const response = await apiRequest("/api/watchlist");
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async addToWatchlist(symbol: string, name: string, assetType: string) {
    const response = await apiRequest("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({
        symbol,
        name,
        assetType,
        currentPrice: "0",
        changePercent: "0",
      })
    });
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async removeFromWatchlist(symbol: string) {
    const response = await apiRequest(`/api/watchlist/${symbol}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async getTrades() {
    const response = await apiRequest("/api/trades");
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async executeTrade(tradeData: any) {
    const response = await apiRequest("/api/trades", {
      method: "POST",
      body: JSON.stringify(tradeData)
    });
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async getTransfers() {
    const response = await apiRequest("/api/transfers");
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async createTransfer(transferData: any) {
    const response = await apiRequest("/api/transfers", {
      method: "POST", 
      body: JSON.stringify(transferData)
    });
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async getActivityLog() {
    const response = await apiRequest("/api/activity");
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  static async logLogin() {
    try {
      await fetch('/api/log-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ts: Date.now() }),
      });
    } catch (e) {
      // dev-only noise: do not bubble to UI
      console.warn('logLogin failed:', (e as Error)?.message);
    }
  }

  static async getHoldings() {
    // Get authenticated user data first to include userId header
    const userResp = await apiRequest("/api/auth/user");
    if (!userResp.ok) throw new Error("Authentication required");
    const userData = await userResp.json();
    
    const response = await apiRequest("/api/holdings", {
      headers: {
        "x-user-id": userData.id || "",
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
}

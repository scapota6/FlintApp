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
}

export class FinancialAPI {
  static async getDashboardData(): Promise<DashboardData> {
    const response = await apiRequest("GET", "/api/dashboard");
    return response.json();
  }

  static async getMarketData(symbol: string): Promise<MarketData> {
    const response = await apiRequest("GET", `/api/market/${symbol}`);
    return response.json();
  }

  static async getAccounts() {
    const response = await apiRequest("GET", "/api/accounts");
    return response.json();
  }

  static async connectAccount(accountData: any) {
    const response = await apiRequest("POST", "/api/accounts", accountData);
    return response.json();
  }

  static async getWatchlist() {
    const response = await apiRequest("GET", "/api/watchlist");
    return response.json();
  }

  static async addToWatchlist(symbol: string, name: string, assetType: string) {
    const response = await apiRequest("POST", "/api/watchlist", {
      symbol,
      name,
      assetType,
      currentPrice: "0",
      changePercent: "0",
    });
    return response.json();
  }

  static async removeFromWatchlist(symbol: string) {
    const response = await apiRequest("DELETE", `/api/watchlist/${symbol}`);
    return response.json();
  }

  static async getTrades() {
    const response = await apiRequest("GET", "/api/trades");
    return response.json();
  }

  static async executeTrade(tradeData: any) {
    const response = await apiRequest("POST", "/api/trades", tradeData);
    return response.json();
  }

  static async getTransfers() {
    const response = await apiRequest("GET", "/api/transfers");
    return response.json();
  }

  static async createTransfer(transferData: any) {
    const response = await apiRequest("POST", "/api/transfers", transferData);
    return response.json();
  }

  static async getActivityLog() {
    const response = await apiRequest("GET", "/api/activity");
    return response.json();
  }

  static async logLogin() {
    const response = await apiRequest("POST", "/api/log-login");
    return response.json();
  }
}

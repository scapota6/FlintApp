/**
 * Demo Mode Service
 * Provides mock data for UI verification without real accounts
 */

export interface DemoAccount {
  id: string;
  name: string;
  type: "bank" | "brokerage" | "crypto";
  balance: number;
  institution: string;
  lastUpdated: Date;
}

export interface DemoHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  change: number;
  changePercent: number;
}

export interface DemoTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: "credit" | "debit";
  category: string;
}

class DemoModeService {
  private isDemoMode: boolean = false;

  setDemoMode(enabled: boolean): void {
    this.isDemoMode = enabled;
  }

  isEnabled(): boolean {
    return this.isDemoMode || process.env.FF_DEMO_MODE === "true";
  }

  /**
   * Generate demo accounts
   */
  getDemoAccounts(): DemoAccount[] {
    if (!this.isEnabled()) return [];

    return [
      {
        id: "demo-1",
        name: "Demo Checking Account",
        type: "bank",
        balance: 12500.50,
        institution: "Demo Bank",
        lastUpdated: new Date(),
      },
      {
        id: "demo-2",
        name: "Demo Investment Account",
        type: "brokerage",
        balance: 45000.00,
        institution: "Demo Broker",
        lastUpdated: new Date(),
      },
      {
        id: "demo-3",
        name: "Demo Crypto Wallet",
        type: "crypto",
        balance: 8500.75,
        institution: "Demo Exchange",
        lastUpdated: new Date(),
      },
    ];
  }

  /**
   * Generate demo portfolio holdings
   */
  getDemoHoldings(): DemoHolding[] {
    if (!this.isEnabled()) return [];

    return [
      {
        id: "holding-1",
        symbol: "AAPL",
        name: "Apple Inc.",
        quantity: 50,
        price: 195.50,
        value: 9775.00,
        change: 2.35,
        changePercent: 1.22,
      },
      {
        id: "holding-2",
        symbol: "GOOGL",
        name: "Alphabet Inc.",
        quantity: 25,
        price: 178.25,
        value: 4456.25,
        change: -1.75,
        changePercent: -0.97,
      },
      {
        id: "holding-3",
        symbol: "MSFT",
        name: "Microsoft Corporation",
        quantity: 30,
        price: 425.50,
        value: 12765.00,
        change: 3.25,
        changePercent: 0.77,
      },
      {
        id: "holding-4",
        symbol: "TSLA",
        name: "Tesla Inc.",
        quantity: 15,
        price: 245.75,
        value: 3686.25,
        change: 5.50,
        changePercent: 2.29,
      },
    ];
  }

  /**
   * Generate demo transactions
   */
  getDemoTransactions(): DemoTransaction[] {
    if (!this.isEnabled()) return [];

    const today = new Date();
    return [
      {
        id: "trans-1",
        date: new Date(today.setDate(today.getDate() - 1)),
        description: "Direct Deposit - Salary",
        amount: 3500.00,
        type: "credit",
        category: "Income",
      },
      {
        id: "trans-2",
        date: new Date(today.setDate(today.getDate() - 2)),
        description: "Amazon Purchase",
        amount: 125.50,
        type: "debit",
        category: "Shopping",
      },
      {
        id: "trans-3",
        date: new Date(today.setDate(today.getDate() - 3)),
        description: "Utility Bill Payment",
        amount: 185.75,
        type: "debit",
        category: "Bills",
      },
      {
        id: "trans-4",
        date: new Date(today.setDate(today.getDate() - 4)),
        description: "Stock Dividend - AAPL",
        amount: 45.00,
        type: "credit",
        category: "Investment",
      },
      {
        id: "trans-5",
        date: new Date(today.setDate(today.getDate() - 5)),
        description: "Restaurant Payment",
        amount: 85.25,
        type: "debit",
        category: "Dining",
      },
    ];
  }

  /**
   * Generate demo market data
   */
  getDemoMarketData(symbol: string) {
    if (!this.isEnabled()) return null;

    const mockPrices: Record<string, number> = {
      AAPL: 195.50,
      GOOGL: 178.25,
      MSFT: 425.50,
      TSLA: 245.75,
      AMZN: 185.50,
      META: 515.25,
      NVDA: 125.75,
      SPY: 450.50,
    };

    const price = mockPrices[symbol] || Math.random() * 200 + 50;
    const change = (Math.random() - 0.5) * 10;
    const changePercent = (change / price) * 100;

    return {
      symbol,
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      volume: Math.floor(Math.random() * 10000000),
      high: Number((price * 1.02).toFixed(2)),
      low: Number((price * 0.98).toFixed(2)),
      open: Number((price - change).toFixed(2)),
      previousClose: Number((price - change).toFixed(2)),
      timestamp: new Date(),
    };
  }

  /**
   * Simulate API response with demo data
   */
  wrapApiResponse<T>(realData: T | null, demoData: T): T {
    if (this.isEnabled() && !realData) {
      console.log("[Demo Mode] Returning demo data");
      return demoData;
    }
    return realData || demoData;
  }
}

// Export singleton instance
export const demoMode = new DemoModeService();
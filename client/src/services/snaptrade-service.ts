import { apiRequest } from "@/lib/queryClient";

export interface SnapTradeAccount {
  id: string;
  name: string;
  type: string;
  balance: {
    total: {
      amount: number;
      currency: string;
    };
  };
  institution_name: string;
}

export interface SnapTradePosition {
  symbol: string;
  units: number;
  price: number;
  open_pnl: number;
  fractional_units: number;
  average_purchase_price: number;
}

export interface SnapTradeOrder {
  id: string;
  symbol: string;
  status: string;
  units: number;
  action: string;
  order_type: string;
  time_in_force: string;
  filled_units: number;
  price: number;
  stop_price?: number;
  limit_price?: number;
  created_at: string;
}

export interface SnapTradeSymbol {
  id: string;
  symbol: string;
  raw_symbol: string;
  description: string;
  currency: string;
  exchange: string;
  type: string;
}

export class SnapTradeService {
  // Account Management
  static async getAccounts(): Promise<SnapTradeAccount[]> {
    try {
      const response = await apiRequest('GET', '/api/snaptrade/accounts');
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      return data.accounts || [];
    } catch (error) {
      console.error('Error fetching SnapTrade accounts:', error);
      return [];
    }
  }

  static async getAccountDetails(accountId: string): Promise<SnapTradeAccount | null> {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/accounts/${accountId}`);
      if (!response.ok) throw new Error('Failed to fetch account details');
      return await response.json();
    } catch (error) {
      console.error('Error fetching account details:', error);
      return null;
    }
  }

  static async getAccountPositions(accountId: string): Promise<SnapTradePosition[]> {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/accounts/${accountId}/positions`);
      if (!response.ok) throw new Error('Failed to fetch positions');
      return await response.json();
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [];
    }
  }

  static async getAccountOrders(accountId: string): Promise<SnapTradeOrder[]> {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/accounts/${accountId}/orders`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return await response.json();
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  }

  // Symbol Search and Reference Data
  static async searchSymbols(query: string): Promise<SnapTradeSymbol[]> {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/symbols/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to search symbols');
      return await response.json();
    } catch (error) {
      console.error('Error searching symbols:', error);
      return [];
    }
  }

  // Trading Operations
  static async placeEquityOrder(params: {
    accountId: string;
    symbolId: string;
    units: number;
    orderType: 'Market' | 'Limit' | 'Stop' | 'StopLimit';
    timeInForce: 'Day' | 'GTC' | 'IOC' | 'FOK';
    limitPrice?: number;
    stopPrice?: number;
  }) {
    try {
      const response = await apiRequest('POST', '/api/snaptrade/orders/place', {
        body: JSON.stringify(params),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to place order');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error placing equity order:', error);
      throw error;
    }
  }

  static async placeCryptoOrder(params: {
    accountId: string;
    symbolId: string;
    units: number;
    orderType: 'Market' | 'Limit';
    timeInForce: 'Day' | 'GTC' | 'IOC' | 'FOK';
  }) {
    try {
      const response = await apiRequest('POST', '/api/snaptrade/orders/place-crypto', {
        body: JSON.stringify(params),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to place crypto order');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error placing crypto order:', error);
      throw error;
    }
  }

  static async cancelOrder(orderId: string, accountId: string) {
    try {
      const response = await apiRequest('DELETE', `/api/snaptrade/orders/${orderId}`, {
        body: JSON.stringify({ accountId }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel order');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  // Market Data
  static async getQuotes(symbols: string[]) {
    try {
      const response = await apiRequest('POST', '/api/snaptrade/quotes', {
        body: JSON.stringify({ symbols }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch quotes');
      return await response.json();
    } catch (error) {
      console.error('Error fetching quotes:', error);
      return null;
    }
  }

  // Connection Management
  static async connectBrokerage() {
    try {
      const response = await apiRequest('POST', '/api/snaptrade/register');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to register with SnapTrade');
      }
      
      const data = await response.json();
      
      if (data.url) {
        // Open connection portal in popup
        const popup = window.open(
          data.url,
          'snaptrade_connect',
          'width=800,height=600,scrollbars=yes,resizable=yes'
        );

        return new Promise((resolve, reject) => {
          const checkClosed = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkClosed);
              resolve(true);
            }
          }, 1000);

          // Timeout after 10 minutes
          setTimeout(() => {
            clearInterval(checkClosed);
            if (popup && !popup.closed) {
              popup.close();
            }
            reject(new Error('Connection timeout'));
          }, 600000);
        });
      }
      
      return data;
    } catch (error) {
      console.error('Error connecting brokerage:', error);
      throw error;
    }
  }

  static async syncAccounts() {
    try {
      const response = await apiRequest('POST', '/api/snaptrade/sync');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync accounts');
      }
      return await response.json();
    } catch (error) {
      console.error('Error syncing accounts:', error);
      throw error;
    }
  }
}
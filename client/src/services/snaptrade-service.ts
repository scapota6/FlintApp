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

  static async getAccountBalance(accountId: string) {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/accounts/${accountId}/balance`);
      if (!response.ok) throw new Error('Failed to fetch account balance');
      const data = await response.json();
      return data.balance;
    } catch (error) {
      console.error('Error fetching account balance:', error);
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

  static async getRecentOrders(accountId: string, onlyExecuted: boolean = true): Promise<SnapTradeOrder[]> {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/accounts/${accountId}/orders/recent?onlyExecuted=${onlyExecuted}`);
      if (!response.ok) throw new Error('Failed to fetch recent orders');
      const data = await response.json();
      return data.orders || [];
    } catch (error) {
      console.error('Error fetching recent orders:', error);
      return [];
    }
  }

  static async getAccountActivities(accountId: string, options?: {
    startDate?: string;
    endDate?: string;
    offset?: number;
    limit?: number;
    type?: string;
  }) {
    try {
      const params = new URLSearchParams();
      if (options?.startDate) params.append('startDate', options.startDate);
      if (options?.endDate) params.append('endDate', options.endDate);
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.type) params.append('type', options.type);

      const response = await apiRequest('GET', `/api/snaptrade/accounts/${accountId}/activities?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch account activities');
      const data = await response.json();
      return data.activities || [];
    } catch (error) {
      console.error('Error fetching account activities:', error);
      return [];
    }
  }

  static async getOptionHoldings(accountId: string) {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/accounts/${accountId}/options`);
      if (!response.ok) throw new Error('Failed to fetch option holdings');
      const data = await response.json();
      return data.optionHoldings || [];
    } catch (error) {
      console.error('Error fetching option holdings:', error);
      return [];
    }
  }

  // Connection Management
  static async getConnections() {
    try {
      const response = await apiRequest('GET', '/api/snaptrade/connections');
      if (!response.ok) throw new Error('Failed to fetch connections');
      const data = await response.json();
      return data.connections || [];
    } catch (error) {
      console.error('Error fetching connections:', error);
      return [];
    }
  }

  static async getConnectionDetail(authorizationId: string) {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/connections/${authorizationId}`);
      if (!response.ok) throw new Error('Failed to fetch connection details');
      const data = await response.json();
      return data.connection;
    } catch (error) {
      console.error('Error fetching connection details:', error);
      return null;
    }
  }

  static async removeConnection(authorizationId: string) {
    try {
      const response = await apiRequest('DELETE', `/api/snaptrade/connections/${authorizationId}`);
      if (!response.ok) throw new Error('Failed to remove connection');
      return await response.json();
    } catch (error) {
      console.error('Error removing connection:', error);
      throw error;
    }
  }

  static async refreshConnection(authorizationId: string) {
    try {
      const response = await apiRequest('POST', `/api/snaptrade/connections/${authorizationId}/refresh`);
      if (!response.ok) throw new Error('Failed to refresh connection');
      return await response.json();
    } catch (error) {
      console.error('Error refreshing connection:', error);
      throw error;
    }
  }

  static async disableConnection(authorizationId: string) {
    try {
      const response = await apiRequest('POST', `/api/snaptrade/connections/${authorizationId}/disable`);
      if (!response.ok) throw new Error('Failed to disable connection');
      return await response.json();
    } catch (error) {
      console.error('Error disabling connection:', error);
      throw error;
    }
  }

  // Reference Data
  static async getPartnerInfo() {
    try {
      const response = await apiRequest('GET', '/api/snaptrade/partner-info');
      if (!response.ok) throw new Error('Failed to fetch partner info');
      const data = await response.json();
      return data.partnerInfo;
    } catch (error) {
      console.error('Error fetching partner info:', error);
      return null;
    }
  }

  static async getBrokerages() {
    try {
      const response = await apiRequest('GET', '/api/snaptrade/reference/brokerages');
      if (!response.ok) throw new Error('Failed to fetch brokerages');
      const data = await response.json();
      return data.brokerages || [];
    } catch (error) {
      console.error('Error fetching brokerages:', error);
      return [];
    }
  }

  static async getSecurityTypes() {
    try {
      const response = await apiRequest('GET', '/api/snaptrade/reference/security-types');
      if (!response.ok) throw new Error('Failed to fetch security types');
      const data = await response.json();
      return data.securityTypes || [];
    } catch (error) {
      console.error('Error fetching security types:', error);
      return [];
    }
  }

  static async searchSymbolsGlobal(query: string): Promise<SnapTradeSymbol[]> {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/reference/symbols?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to search symbols');
      const data = await response.json();
      return data.symbols || [];
    } catch (error) {
      console.error('Error searching symbols globally:', error);
      return [];
    }
  }

  static async getSymbolByTicker(ticker: string) {
    try {
      const response = await apiRequest('GET', `/api/snaptrade/reference/symbols/${encodeURIComponent(ticker)}`);
      if (!response.ok) throw new Error('Failed to get symbol');
      const data = await response.json();
      return data.symbol;
    } catch (error) {
      console.error('Error getting symbol by ticker:', error);
      return null;
    }
  }

  // Symbol Search and Reference Data (account-specific)
  static async searchSymbols(query: string, accountId?: string): Promise<SnapTradeSymbol[]> {
    try {
      let endpoint;
      if (accountId) {
        endpoint = `/api/snaptrade/accounts/${accountId}/symbols/search?query=${encodeURIComponent(query)}`;
      } else {
        endpoint = `/api/snaptrade/symbols/search?query=${encodeURIComponent(query)}`;
      }
      
      const response = await apiRequest('GET', endpoint);
      if (!response.ok) throw new Error('Failed to search symbols');
      const data = await response.json();
      return data.symbols || [];
    } catch (error) {
      console.error('Error searching symbols:', error);
      return [];
    }
  }

  // User Management (Admin functions)
  static async listUsers() {
    try {
      const response = await apiRequest('GET', '/api/snaptrade/users');
      if (!response.ok) throw new Error('Failed to list users');
      const data = await response.json();
      return data.users || [];
    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  }

  static async deleteUser(userId: string) {
    try {
      const response = await apiRequest('DELETE', `/api/snaptrade/users/${userId}`);
      if (!response.ok) throw new Error('Failed to delete user');
      return await response.json();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  static async resetUserSecret(userId: string, userSecret: string) {
    try {
      const response = await apiRequest('POST', `/api/snaptrade/users/${userId}/reset-secret`, {
        body: JSON.stringify({ userSecret }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to reset user secret');
      return await response.json();
    } catch (error) {
      console.error('Error resetting user secret:', error);
      throw error;
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
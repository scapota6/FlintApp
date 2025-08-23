import { apiRequest } from '@/lib/queryClient';

export interface TellerAccount {
  id: string;
  name: string;
  type: string;
  subtype: string;
  institution: {
    name: string;
    id: string;
  };
  balances?: {
    current: number;
    available?: number;
    ledger?: number;
  };
  balance?: {
    available?: number;
    current?: number;
    ledger?: number;
  };
  status?: string;
  currency?: string;
  enrollment_id?: string;
  last_four?: string;
  details?: any;
}

export interface TellerBalance {
  account_id: string;
  available: string;
  ledger: string;
  current?: string;
  links: {
    account: string;
    self: string;
  };
}

export interface TellerDetails {
  account_id: string;
  account_number: string;
  links: {
    account: string;
    self: string;
  };
  routing_numbers: {
    ach: string;
  };
  // Credit card specific fields
  credit_limit?: string;
  available_credit?: string;
}

export interface TellerTransaction {
  id: string;
  account_id: string;
  amount: string;
  date: string;
  description: string;
  type: string;
  status: string;
  links: {
    account: string;
    self: string;
  };
}

class TellerService {
  /**
   * Get all connected Teller accounts for the current user
   */
  async getAccounts(): Promise<TellerAccount[]> {
    const response = await apiRequest('/api/teller/accounts');
    if (!response.ok) {
      throw new Error(`Failed to fetch accounts: ${response.status}`);
    }
    const data = await response.json();
    return data.accounts || [];
  }

  /**
   * Get balance information for a specific account
   */
  async getBalances(accountId: string): Promise<TellerBalance> {
    const response = await apiRequest(`/api/teller/balances/${accountId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch balances for account ${accountId}: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get credit metadata for credit cards (credit_limit, available_credit)
   */
  async getCreditMetadata(accountId: string): Promise<TellerDetails> {
    const response = await apiRequest(`/api/teller/details/${accountId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch credit metadata for account ${accountId}: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get transactions for an account (used as fallback for balance computation)
   */
  async getTransactions(
    accountId: string, 
    from?: string, 
    to?: string,
    count: number = 100
  ): Promise<TellerTransaction[]> {
    const params = new URLSearchParams({
      count: count.toString()
    });
    
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const response = await apiRequest(`/api/teller/transactions/${accountId}?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions for account ${accountId}: ${response.status}`);
    }
    const data = await response.json();
    return data.transactions || [];
  }
}

export const tellerService = new TellerService();
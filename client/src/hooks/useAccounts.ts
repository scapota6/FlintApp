import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Account {
  id: string;
  provider: 'teller' | 'snaptrade';
  accountName: string;
  accountNumber?: string;
  balance: number;
  type: 'bank' | 'investment' | 'crypto' | 'credit';
  institution: string;
  lastUpdated: string;
  currency?: string;
  status?: 'connected' | 'disconnected' | 'expired';
  lastCheckedAt?: string;
  // Extended fields for UI
  holdings?: number;
  cash?: number;
  buyingPower?: number;
  percentOfTotal?: number;
  availableCredit?: number | null;
  amountSpent?: number | null;
}

export interface AccountsResponse {
  accounts: Account[];
  disconnected?: Array<{
    id: string;
    name: string;
    institutionName: string;
    status: string;
    lastCheckedAt: string;
  }>;
}

/**
 * Single source of truth for all account data
 * Fetches from separate bank and brokerage endpoints for now
 * TODO: Switch to unified endpoint once all components are updated
 */
export function useAccounts() {
  return useQuery<AccountsResponse>({
    queryKey: ['/api/accounts'],
    queryFn: async () => {
      // Fetch from separate endpoints that the backend expects
      const [banksResponse, brokeragesResponse] = await Promise.all([
        apiRequest('GET', '/api/accounts/banks'),
        apiRequest('GET', '/api/accounts/brokerages')
      ]);

      if (!banksResponse.ok || !brokeragesResponse.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const [banksData, brokeragesData] = await Promise.all([
        banksResponse.json(),
        brokeragesResponse.json()
      ]);

      // Combine accounts and disconnected arrays
      const allAccounts = [
        ...(banksData.accounts || []).map((account: any) => ({
          ...account,
          type: account.type || 'bank'
        })),
        ...(brokeragesData.accounts || []).map((account: any) => ({
          ...account,
          type: 'investment'
        }))
      ];

      const allDisconnected = [
        ...(banksData.disconnected || []),
        ...(brokeragesData.disconnected || [])
      ];

      return {
        accounts: allAccounts,
        disconnected: allDisconnected.length > 0 ? allDisconnected : undefined
      };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2
  });
}

/**
 * Hook for account health status
 */
export function useAccountHealth() {
  return useQuery({
    queryKey: ['/api/accounts/health'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Check every 10 minutes
  });
}

/**
 * Computed portfolio totals from connected accounts only
 */
export function usePortfolioTotals() {
  const { data: accountsData } = useAccounts();

  if (!accountsData?.accounts) {
    return {
      totalBalance: 0,
      bankBalance: 0,
      investmentValue: 0,
      cryptoValue: 0,
      accountCount: 0
    };
  }

  const connected = accountsData.accounts; // Only connected accounts are returned

  const totals = connected.reduce((acc, account) => {
    const balance = account.balance || 0;
    acc.totalBalance += balance;
    
    switch (account.type) {
      case 'bank':
      case 'credit':
        acc.bankBalance += balance;
        break;
      case 'investment':
        acc.investmentValue += balance;
        break;
      case 'crypto':
        acc.cryptoValue += balance;
        break;
    }
    
    return acc;
  }, {
    totalBalance: 0,
    bankBalance: 0,
    investmentValue: 0,
    cryptoValue: 0
  });

  return {
    ...totals,
    accountCount: connected.length
  };
}
import { useQuery } from '@tanstack/react-query';
import { tellerService, type TellerAccount, type TellerBalance, type TellerDetails } from '@/services/teller';

export type ComputedAccount = {
  id: string;
  name: string;
  institution: string;
  type: string; // teller type
  subtype: string; // teller subtype
  available_balance?: number;
  ledger_balance?: number;
  credit_limit?: number;
  available_credit?: number;
  current_balance?: number; // liabilities
  amount_spent_cycle?: number; // for credit cards
  display_value: number; // what the card shows
  display_label: 'Available balance' | 'Amount spent';
  display_color: 'green' | 'red';
  percent_of_total?: number; // assets only
};

/**
 * Hook that fetches accounts and computes display fields according to ChatGPT rules:
 * - Assets (checking/savings): Show available_balance in green with "X% of total"
 * - Credit cards: Show amount spent in red with "Credit available — $X"
 */
export function useAccounts() {
  // Fetch all accounts
  const { 
    data: accounts, 
    isLoading: accountsLoading, 
    error: accountsError 
  } = useQuery({
    queryKey: ['teller', 'accounts'],
    queryFn: () => tellerService.getAccounts(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - poll balances no more than once per session
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false, // Don't refetch on window focus to respect rate limits
  });

  // Fetch balances for all accounts
  const { 
    data: balancesData, 
    isLoading: balancesLoading, 
    error: balancesError 
  } = useQuery({
    queryKey: ['teller', 'balances', accounts?.map(a => a.id)],
    queryFn: async () => {
      if (!accounts) return {};
      
      const balancePromises = accounts.map(async (account) => {
        try {
          const balance = await tellerService.getBalances(account.id);
          return { [account.id]: balance };
        } catch (error) {
          console.warn(`Failed to fetch balance for account ${account.id}:`, error);
          return { [account.id]: null };
        }
      });

      const balanceResults = await Promise.all(balancePromises);
      return balanceResults.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, TellerBalance | null>);
    },
    enabled: !!accounts && accounts.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - poll balances no more than once per session
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false, // Don't refetch on window focus to respect rate limits
  });

  // Fetch credit metadata for credit cards
  const { 
    data: creditData, 
    isLoading: creditLoading 
  } = useQuery({
    queryKey: ['teller', 'credit-metadata', accounts?.filter(a => a.type === 'credit').map(a => a.id)],
    queryFn: async () => {
      if (!accounts) return {};
      
      const creditAccounts = accounts.filter(account => account.type === 'credit');
      if (creditAccounts.length === 0) return {};

      const creditPromises = creditAccounts.map(async (account) => {
        try {
          const details = await tellerService.getCreditMetadata(account.id);
          return { [account.id]: details };
        } catch (error) {
          console.warn(`Failed to fetch credit metadata for account ${account.id}:`, error);
          return { [account.id]: null };
        }
      });

      const creditResults = await Promise.all(creditPromises);
      return creditResults.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, TellerDetails | null>);
    },
    enabled: !!accounts && accounts.some(a => a.type === 'credit'),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - poll balances no more than once per session
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false, // Don't refetch on window focus to respect rate limits
  });

  // Compute accounts with display fields
  const accountsWithComputedFields: ComputedAccount[] = accounts?.map((account: TellerAccount) => {
    const balance = (balancesData as any)?.[account.id] as TellerBalance | null;
    const creditDetails = (creditData as any)?.[account.id] as TellerDetails | null;

    // Parse balance values
    const availableBalance = balance?.available ? parseFloat(balance.available) : undefined;
    const ledgerBalance = balance?.ledger ? parseFloat(balance.ledger) : undefined;
    const currentBalance = balance?.current ? parseFloat(balance.current) : undefined;
    
    // Parse credit values
    const creditLimit = creditDetails?.credit_limit ? parseFloat(creditDetails.credit_limit) : undefined;
    const availableCredit = creditDetails?.available_credit ? parseFloat(creditDetails.available_credit) : undefined;

    // Map subtype → asset vs liability based on Teller account types
    // If account subtype is unknown, default to asset display
    const isAsset = account.type === 'credit' ? false : true; // Default to asset unless explicitly credit
    const isCredit = account.type === 'credit';

    let displayValue: number;
    let displayLabel: 'Available balance' | 'Amount spent';
    let displayColor: 'green' | 'red';
    let amountSpentCycle: number | undefined;

    if (isCredit) {
      // Credit cards: Show amount spent in red
      // Primary: current_balance, Fallback: credit_limit - available_credit
      if (currentBalance !== undefined && currentBalance !== null) {
        amountSpentCycle = Math.abs(currentBalance); // Current balance is negative for spending
        displayValue = amountSpentCycle;
      } else if (creditLimit !== undefined && creditLimit !== null && 
                 availableCredit !== undefined && availableCredit !== null) {
        amountSpentCycle = creditLimit - availableCredit;
        displayValue = amountSpentCycle;
      } else {
        // Last resort: try to compute from account balance data
        const accountBalance = account.balance?.current || account.balances?.current;
        amountSpentCycle = accountBalance ? Math.abs(accountBalance) : 0;
        displayValue = amountSpentCycle;
      }
      
      displayLabel = 'Amount spent';
      displayColor = 'red';
    } else {
      // Assets: display_value = available_balance, color green
      // Handle null values - if Teller returns null, use 0 but mark as unavailable
      displayValue = availableBalance !== null && availableBalance !== undefined ? 
                   availableBalance : 
                   (ledgerBalance !== null && ledgerBalance !== undefined ? 
                    ledgerBalance : 
                    (currentBalance !== null && currentBalance !== undefined ? currentBalance : 0));
      displayLabel = 'Available balance';
      displayColor = 'green';
    }

    return {
      id: account.id,
      name: account.name,
      institution: account.institution?.name || 'Unknown',
      type: account.type,
      subtype: account.subtype,
      available_balance: availableBalance,
      ledger_balance: ledgerBalance,
      credit_limit: creditLimit,
      available_credit: availableCredit,
      current_balance: currentBalance,
      amount_spent_cycle: amountSpentCycle,
      display_value: displayValue,
      display_label: displayLabel,
      display_color: displayColor,
      // percent_of_total will be calculated below
    } as ComputedAccount;
  }) || [];

  // Compute percent_of_total using sum of asset available_balance
  // Only include accounts with valid available_balance (not null/undefined)
  const assetAccounts = accountsWithComputedFields.filter(acc => 
    acc.type !== 'credit' && 
    acc.available_balance !== null && 
    acc.available_balance !== undefined
  );
  
  const totalAssetValue = assetAccounts.reduce((sum, acc) => sum + (acc.available_balance || 0), 0);
  
  // Add percent_of_total to asset accounts - if Teller returns null, do not compute percent
  const finalAccounts = accountsWithComputedFields.map(account => {
    if (assetAccounts.includes(account) && totalAssetValue > 0 && 
        account.available_balance !== null && account.available_balance !== undefined) {
      return {
        ...account,
        percent_of_total: Math.round((account.available_balance / totalAssetValue) * 100)
      };
    }
    return account;
  });

  return {
    accounts: finalAccounts,
    isLoading: accountsLoading || balancesLoading || creditLoading,
    error: accountsError || balancesError,
    totalAssetValue,
    assetCount: assetAccounts.length,
    creditCount: accountsWithComputedFields.filter(acc => acc.type === 'credit').length
  };
}
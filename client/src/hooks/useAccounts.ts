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
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
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
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
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
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
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

    // Determine account classification
    const isAsset = account.type === 'depository' || 
                   (account.type === 'investment' && account.subtype !== 'credit');
    const isCredit = account.type === 'credit';

    let displayValue: number;
    let displayLabel: 'Available balance' | 'Amount spent';
    let displayColor: 'green' | 'red';
    let amountSpentCycle: number | undefined;

    if (isCredit) {
      // Credit cards: Show amount spent in red
      // Primary: current_balance, Fallback: credit_limit - available_credit
      if (currentBalance !== undefined) {
        amountSpentCycle = Math.abs(currentBalance); // Current balance is negative for spending
        displayValue = amountSpentCycle;
      } else if (creditLimit !== undefined && availableCredit !== undefined) {
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
      // Assets: Show available balance in green
      displayValue = availableBalance || ledgerBalance || currentBalance || 0;
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

  // Calculate percentages (only for assets)
  const assetAccounts = accountsWithComputedFields.filter(acc => 
    acc.type === 'depository' || (acc.type === 'investment' && acc.subtype !== 'credit')
  );
  
  const totalAssetValue = assetAccounts.reduce((sum, acc) => sum + acc.display_value, 0);
  
  // Add percent_of_total to asset accounts
  const finalAccounts = accountsWithComputedFields.map(account => {
    if (assetAccounts.includes(account) && totalAssetValue > 0) {
      return {
        ...account,
        percent_of_total: Math.round((account.display_value / totalAssetValue) * 100)
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
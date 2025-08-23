import { storage } from "../storage";
import { logger } from "@shared/logger";

interface TellerAccount {
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

interface TellerClient {
  accounts: {
    get: (accountId: string) => Promise<TellerAccount>;
    list: () => Promise<TellerAccount[]>;
  };
  transactions: {
    list: (params: { account_id: string; count?: number }) => Promise<any[]>;
  };
  payments: {
    create: (fromAccountId: string, payload: any) => Promise<any>;
    get: (paymentId: string) => Promise<any>;
  };
  balances: {
    get: (accountId: string) => Promise<any>;
  };
  details: {
    get: (accountId: string) => Promise<any>;
  };
}

/**
 * Creates a Teller client instance for a specific user
 * Manages authentication tokens per user account
 */
export async function tellerForUser(userId: string): Promise<TellerClient> {
  // Get user's Teller accounts to find access tokens
  const accounts = await storage.getConnectedAccountsByProvider(userId, 'teller');
  
  if (!accounts || accounts.length === 0) {
    throw new Error('No Teller accounts connected for this user');
  }
  
  // Create a map of account IDs to access tokens for quick lookup
  const tokenMap = new Map<string, string>();
  accounts.forEach(acc => {
    const token = acc.accessToken;
    if (token && typeof token === 'string' && acc.externalAccountId) {
      tokenMap.set(acc.externalAccountId, token);
    }
  });
  
  console.log('[Teller Client] Token mapping created:', {
    userId,
    accountCount: accounts.length,
    tokenMapSize: tokenMap.size,
    accountIds: Array.from(tokenMap.keys()),
    tokenPreviews: Array.from(tokenMap.entries()).map(([id, token]) => ({
      accountId: id,
      tokenPrefix: token.substring(0, 8) + '...',
      tokenLength: token.length,
      isTestToken: token.includes('test') || token.includes('sandbox')
    }))
  });
  
  const client: TellerClient = {
    accounts: {
      async get(accountId: string): Promise<TellerAccount> {
        const token = tokenMap.get(accountId);
        if (!token) {
          console.error('[Teller API] No token found for account:', { 
            accountId, 
            availableAccounts: Array.from(tokenMap.keys()),
            userId 
          });
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        console.log('[Teller API] Calling GET /accounts/:id:', {
          accountId,
          tokenPrefix: token.substring(0, 8) + '...',
          isTestToken: token.includes('test') || token.includes('sandbox'),
          url: `https://api.teller.io/accounts/${accountId}`
        });
        
        const response = await fetch(`https://api.teller.io/accounts/${accountId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Teller API] Account fetch failed:', {
            accountId,
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            tokenPrefix: token.substring(0, 8) + '...'
          });
          const error = new Error(`Teller API error: ${response.status}`);
          (error as any).response = { status: response.status };
          throw error;
        }
        
        const data = await response.json();
        console.log('[Teller API] Account fetch successful:', { accountId, accountType: data.type, accountSubtype: data.subtype });
        
        // Normalize the response to our expected format
        return {
          id: data.id,
          name: data.name,
          type: data.type,
          subtype: data.subtype || data.type, // Fallback to type if subtype not present
          institution: data.institution || { name: 'Unknown', id: '' },
          balances: data.balances,
          balance: data.balance,
          status: data.status,
          currency: data.currency || 'USD',
          enrollment_id: data.enrollment_id,
          last_four: data.last_four,
          details: data.details
        };
      },
      
      async list(): Promise<TellerAccount[]> {
        const allAccounts: TellerAccount[] = [];
        
        // Use Array.from to convert Map entries to array for iteration
        const entries = Array.from(tokenMap.entries());
        for (const [accountId, token] of entries) {
          try {
            const response = await fetch(`https://api.teller.io/accounts/${accountId}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              allAccounts.push({
                id: data.id,
                name: data.name,
                type: data.type,
                subtype: data.subtype || data.type,
                institution: data.institution || { name: 'Unknown', id: '' },
                balances: data.balances,
                status: data.status,
                currency: data.currency || 'USD'
              });
            }
          } catch (error: any) {
            console.error(`[Teller API] Failed to fetch account ${accountId}:`, error.message);
          }
        }
        
        return allAccounts;
      }
    },
    
    transactions: {
      async list(params: { account_id: string; count?: number }): Promise<any[]> {
        const token = tokenMap.get(params.account_id);
        if (!token) {
          throw new Error(`No access token found for account ${params.account_id}`);
        }
        
        const url = new URL(`https://api.teller.io/accounts/${params.account_id}/transactions`);
        if (params.count) {
          url.searchParams.set('count', params.count.toString());
        }
        
        console.log('[Teller API] Calling GET /accounts/:id/transactions:', { 
          accountId: params.account_id, 
          count: params.count,
          url: url.toString()
        });
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Teller API] Transactions fetch failed:', {
            accountId: params.account_id,
            status: response.status,
            error: errorText
          });
          const error = new Error(`Failed to fetch transactions: ${response.status}`);
          (error as any).response = { status: response.status };
          throw error;
        }
        
        const data = await response.json();
        console.log('[Teller API] Transactions fetch successful:', { 
          accountId: params.account_id, 
          transactionCount: data?.length || 0 
        });
        return data || [];
      }
    },
    
    payments: {
      async create(fromAccountId: string, payload: any): Promise<any> {
        const token = tokenMap.get(fromAccountId);
        if (!token) {
          throw new Error(`No access token found for account ${fromAccountId}`);
        }
        
        const response = await fetch(`https://api.teller.io/accounts/${fromAccountId}/payments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          const error: any = new Error(`Payment creation failed: ${response.status} - ${errorText}`);
          
          // Check if MFA/Connect token is required
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.mfa_token || errorData.connect_token) {
              error.requiresConnectToken = errorData.mfa_token || errorData.connect_token;
            }
          } catch {}
          
          throw error;
        }
        
        return response.json();
      },
      
      async get(paymentId: string): Promise<any> {
        // Need to find which account/token to use for this payment
        // For now, try the first available token
        const token = tokenMap.values().next().value;
        if (!token) {
          throw new Error('No access tokens available');
        }
        
        const response = await fetch(`https://api.teller.io/payments/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch payment status: ${response.status}`);
        }
        
        return response.json();
      }
    },
    
    balances: {
      async get(accountId: string): Promise<any> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        console.log('[Teller API] Calling GET /accounts/:id/balances:', { accountId });
        
        const response = await fetch(`https://api.teller.io/accounts/${accountId}/balances`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Teller API] Balances fetch failed:', {
            accountId,
            status: response.status,
            error: errorText
          });
          const error = new Error(`Failed to fetch balances: ${response.status}`);
          (error as any).response = { status: response.status };
          throw error;
        }
        
        const data = await response.json();
        console.log('[Teller API] Balances fetch successful:', { accountId, balanceKeys: Object.keys(data) });
        return data;
      }
    },
    
    details: {
      async get(accountId: string): Promise<any> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        console.log('[Teller API] Calling GET /accounts/:id/details:', { accountId });
        
        const response = await fetch(`https://api.teller.io/accounts/${accountId}/details`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Teller API] Details fetch failed:', {
            accountId,
            status: response.status,
            error: errorText
          });
          const error = new Error(`Failed to fetch details: ${response.status}`);
          (error as any).response = { status: response.status };
          throw error;
        }
        
        const data = await response.json();
        console.log('[Teller API] Details fetch successful:', { accountId, detailKeys: Object.keys(data) });
        return data;
      }
    }
  };
  
  return client;
}

// Helper function to normalize account types
export function toLower(str: string | undefined): string {
  return (str || '').toLowerCase();
}
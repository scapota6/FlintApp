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
  };
  status?: string;
  currency?: string;
}

interface TellerClient {
  accounts: {
    get: (accountId: string) => Promise<TellerAccount>;
    list: () => Promise<TellerAccount[]>;
  };
  payments: {
    create: (fromAccountId: string, payload: any) => Promise<any>;
    get: (paymentId: string) => Promise<any>;
  };
  balances: {
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
    if (token) {
      tokenMap.set(acc.externalAccountId, token);
    }
  });
  
  return {
    accounts: {
      async get(accountId: string): Promise<TellerAccount> {
        const token = tokenMap.get(accountId);
        if (!token) {
          // Try to find token from connected accounts
          const account = accounts.find(a => a.externalAccountId === accountId);
          if (!account?.accessToken) {
            throw new Error(`No access token found for account ${accountId}`);
          }
        }
        
        const response = await fetch(`https://api.teller.io/accounts/${accountId}`, {
          headers: {
            'Authorization': `Bearer ${token || tokenMap.get(accountId)}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch account: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Normalize the response to our expected format
        return {
          id: data.id,
          name: data.name,
          type: data.type,
          subtype: data.subtype || data.type, // Fallback to type if subtype not present
          institution: data.institution || { name: 'Unknown', id: '' },
          balances: data.balances,
          status: data.status,
          currency: data.currency || 'USD'
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
            logger.error(`Failed to fetch account ${accountId}`, { error: error.message });
          }
        }
        
        return allAccounts;
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
          throw new Error(`Payment creation failed: ${response.status} - ${errorText}`);
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
        
        const response = await fetch(`https://api.teller.io/accounts/${accountId}/balances`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch balances: ${response.status}`);
        }
        
        return response.json();
      }
    }
  };
}

// Helper function to normalize account types
export function toLower(str: string | undefined): string {
  return (str || '').toLowerCase();
}
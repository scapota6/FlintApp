import { storage } from "../storage";
import { logger } from "@shared/logger";
import crypto from 'crypto';

// ===== TELLER API TYPES FOLLOWING OFFICIAL DOCUMENTATION =====

interface TellerAccount {
  id: string;
  name: string;
  type: string; // 'depository' or 'credit'
  subtype: string; // checking, savings, money_market, certificate_of_deposit, treasury, sweep, credit_card
  institution: {
    name: string;
    id: string;
  };
  last_four: string;
  status: string; // 'open' or 'closed'
  currency: string; // ISO 4217 currency code
  enrollment_id: string;
  links: {
    self: string;
    details?: string;
    balances?: string;
    transactions?: string;
    payments?: string; // Only present if account supports payments
  };
}

interface TellerBalance {
  account_id: string;
  ledger?: string; // Total amount of funds in the account
  available?: string; // Ledger balance net any pending inflows/outflows
  links: {
    self: string;
    account: string;
  };
}

interface TellerAccountDetails {
  account_id: string;
  account_number: string;
  routing_numbers: {
    ach?: string;
    wire?: string;
    bacs?: string;
  };
  links: {
    self: string;
    account: string;
  };
}

interface TellerTransaction {
  id: string;
  account_id: string;
  amount: string; // Signed amount as string
  date: string; // ISO 8601 date
  description: string; // Unprocessed bank statement description
  status: string; // 'posted' or 'pending'
  type: string; // Transaction type code, e.g. 'card_payment'
  running_balance?: string; // Only present on 'posted' transactions
  details: {
    processing_status: string; // 'pending' or 'complete'
    category?: string; // Teller's categorization
    counterparty?: {
      name?: string;
      type?: string; // 'organization' or 'person'
    };
  };
  links: {
    self: string;
    account: string;
  };
}

interface TellerPayment {
  id: string;
  amount: string;
  memo: string;
  reference?: string;
  date: string;
  payee: {
    scheme: string; // 'zelle'
    address: string; // Email or phone
    name: string;
    type: string; // 'person' or 'business'
  };
  links: {
    self: string;
    account: string;
  };
}

interface TellerIdentity {
  account: TellerAccount;
  owners: Array<{
    type: string; // 'person', 'organization', 'unknown'
    names: Array<{
      type: string; // 'name' or 'alias'
      data: string;
    }>;
    addresses: Array<{
      primary: boolean;
      data: {
        street: string;
        city: string;
        region: string; // 2-letter state code for US
        postal_code: string;
        country: string; // ISO 3166-1 alpha-2
      };
    }>;
    phone_numbers: Array<{
      type: string; // 'mobile', 'home', 'work', 'unknown'
      data: string; // Digits only or +international format
    }>;
    emails: Array<{
      data: string;
    }>;
  }>;
}

interface TellerError {
  error: {
    code: string;
    message: string;
  };
}

interface TellerWebhook {
  id: string;
  payload: {
    enrollment_id?: string;
    reason?: string;
    transactions?: TellerTransaction[];
    account_id?: string;
    status?: string;
  };
  timestamp: string; // ISO 8601
  type: string; // enrollment.disconnected, transactions.processed, account.number_verification.processed, webhook.test
}

interface TellerClient {
  accounts: {
    get: (accountId: string) => Promise<TellerAccount>;
    list: () => Promise<TellerAccount[]>;
    delete: (accountId: string) => Promise<void>;
  };
  transactions: {
    list: (params: { account_id: string; count?: number; from_id?: string }) => Promise<TellerTransaction[]>;
    get: (accountId: string, transactionId: string) => Promise<TellerTransaction>;
  };
  balances: {
    get: (accountId: string) => Promise<TellerBalance>;
  };
  details: {
    get: (accountId: string) => Promise<TellerAccountDetails>;
  };
  payments: {
    discoverSchemes: (accountId: string) => Promise<{ schemes: Array<{ name: string }> }>;
    createPayee: (accountId: string, payee: { scheme: string; address: string; name: string; type: string }) => Promise<any>;
    create: (accountId: string, payment: { amount: string; memo: string; payee: any }) => Promise<TellerPayment>;
    list: (accountId: string) => Promise<TellerPayment[]>;
    get: (accountId: string, paymentId: string) => Promise<TellerPayment>;
  };
  identity: {
    get: () => Promise<TellerIdentity[]>;
  };
}

/**
 * Enhanced error handling following Teller documentation
 * Handles enrollment errors, MFA requirements, and connection states
 */
export function handleTellerError(error: any, context: string) {
  const status = error?.response?.status || error?.status;
  const errorBody = error?.responseBody || error?.error;
  
  console.error(`Teller ${context} error:`, {
    status,
    error: errorBody,
    message: error?.message
  });
  
  // Handle specific Teller error patterns from docs
  if (status === 404 && errorBody?.code?.startsWith('enrollment.disconnected')) {
    throw new Error(`ENROLLMENT_DISCONNECTED: ${errorBody.message}. User needs to reconnect via Teller Connect.`);
  }
  
  if (status === 410 && errorBody?.code === 'account.closed') {
    throw new Error(`ACCOUNT_CLOSED: ${errorBody.message}. Account is no longer accessible.`);
  }
  
  if (status === 404 && errorBody?.code === 'account_number_verification_pending') {
    throw new Error(`VERIFICATION_PENDING: Account details are pending microdeposit verification.`);
  }
  
  if (status === 404 && errorBody?.code === 'account_number_verification_expired') {
    throw new Error(`VERIFICATION_EXPIRED: Account details verification has expired.`);
  }
  
  if (status === 429) {
    throw new Error(`RATE_LIMIT_EXCEEDED: Too many requests. Please wait before retrying.`);
  }
  
  if (status === 502) {
    throw new Error(`BANK_UNAVAILABLE: The financial institution is currently unavailable.`);
  }
  
  if (status === 400) {
    throw new Error(`BAD_REQUEST: ${errorBody?.message || 'Invalid request parameters'}`);
  }
  
  if (status === 401) {
    throw new Error(`UNAUTHORIZED: Invalid or missing access token.`);
  }
  
  if (status === 403) {
    throw new Error(`FORBIDDEN: Access token is invalid or revoked.`);
  }
  
  if (status === 422) {
    throw new Error(`INVALID_REQUEST: ${errorBody?.message || 'Invalid request body'}`);
  }
  
  throw error;
}

/**
 * Webhook signature verification following Teller documentation
 * Implements HMAC SHA-256 verification with replay attack protection
 */
export function verifyTellerWebhook(payload: string, signature: string, secret: string): boolean {
  try {
    // Parse signature header: t=timestamp,v1=signature1,v1=signature2,...
    const elements = signature.split(',');
    const timestamp = elements.find(e => e.startsWith('t='))?.slice(2);
    const signatures = elements.filter(e => e.startsWith('v1='));
    
    if (!timestamp || signatures.length === 0) {
      console.error('Invalid signature format');
      return false;
    }
    
    // Check for replay attacks (reject if older than 3 minutes)
    const signatureTime = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 3 * 60; // 3 minutes in seconds
    
    if (currentTime - signatureTime > maxAge) {
      console.error('Webhook signature is too old (replay attack protection)');
      return false;
    }
    
    // Create signed message: timestamp.payload
    const signedMessage = `${timestamp}.${payload}`;
    
    // Verify at least one signature matches
    for (const sig of signatures) {
      const expectedSignature = sig.slice(3); // Remove 'v1=' prefix
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedMessage)
        .digest('hex');
        
      if (crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(computedSignature, 'hex')
      )) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return false;
  }
}

/**
 * Creates a Teller client instance for a specific user
 * Follows official Teller.io API documentation patterns
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
    accountIds: Array.from(tokenMap.keys())
  });
  
  const client: TellerClient = {
    accounts: {
      async get(accountId: string): Promise<TellerAccount> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            const error: any = new Error(`Teller API error: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'accounts.get');
          }
          
          const data = await response.json();
          return data;
        } catch (error: any) {
          handleTellerError(error, 'accounts.get');
          throw error;
        }
      },
      
      async list(): Promise<TellerAccount[]> {
        const allAccounts: TellerAccount[] = [];
        
        // Get accounts for all tokens - following docs pattern
        const entries = Array.from(tokenMap.entries());
        for (const [accountId, token] of entries) {
          try {
            const response = await fetch(`https://api.teller.io/accounts`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            
            if (response.ok) {
              const accounts = await response.json();
              allAccounts.push(...accounts);
            }
          } catch (error: any) {
            console.error(`[Teller API] Failed to list accounts for token:`, error.message);
          }
        }
        
        return allAccounts;
      },
      
      async delete(accountId: string): Promise<void> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            const error: any = new Error(`Failed to delete account: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'accounts.delete');
          }
        } catch (error: any) {
          handleTellerError(error, 'accounts.delete');
          throw error;
        }
      }
    },
    
    transactions: {
      async list(params: { account_id: string; count?: number; from_id?: string }): Promise<TellerTransaction[]> {
        const token = tokenMap.get(params.account_id);
        if (!token) {
          throw new Error(`No access token found for account ${params.account_id}`);
        }
        
        const url = new URL(`https://api.teller.io/accounts/${params.account_id}/transactions`);
        if (params.count) {
          url.searchParams.set('count', params.count.toString());
        }
        if (params.from_id) {
          url.searchParams.set('from_id', params.from_id);
        }
        
        try {
          const response = await fetch(url.toString(), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            const error: any = new Error(`Failed to fetch transactions: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'transactions.list');
          }
          
          const data = await response.json();
          return data || [];
        } catch (error: any) {
          handleTellerError(error, 'transactions.list');
          throw error;
        }
      },
      
      async get(accountId: string, transactionId: string): Promise<TellerTransaction> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}/transactions/${transactionId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            const error: any = new Error(`Failed to fetch transaction: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'transactions.get');
          }
          
          return await response.json();
        } catch (error: any) {
          handleTellerError(error, 'transactions.get');
          throw error;
        }
      }
    },
    
    balances: {
      async get(accountId: string): Promise<TellerBalance> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}/balances`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            const error: any = new Error(`Failed to fetch balances: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'balances.get');
          }
          
          return await response.json();
        } catch (error: any) {
          handleTellerError(error, 'balances.get');
          throw error;
        }
      }
    },
    
    details: {
      async get(accountId: string): Promise<TellerAccountDetails> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}/details`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            const error: any = new Error(`Failed to fetch account details: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'details.get');
          }
          
          return await response.json();
        } catch (error: any) {
          handleTellerError(error, 'details.get');
          throw error;
        }
      }
    },
    
    // ===== PAYMENTS API - FOLLOWING OFFICIAL TELLER DOCUMENTATION =====
    payments: {
      /**
       * Discover supported payment schemes for an account
       * Following: https://teller.io/docs/api/account/payments#discover-supported-payment-schemes
       */
      async discoverSchemes(accountId: string): Promise<{ schemes: Array<{ name: string }> }> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}/payments`, {
            method: 'OPTIONS',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            const error: any = new Error(`Failed to discover payment schemes: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'payments.discoverSchemes');
          }
          
          return await response.json();
        } catch (error: any) {
          handleTellerError(error, 'payments.discoverSchemes');
          throw error;
        }
      },
      
      /**
       * Create a payee for future payments
       * Following: https://teller.io/docs/api/account/payments#create-a-payee
       */
      async createPayee(accountId: string, payee: { 
        scheme: string; 
        address: string; 
        name: string; 
        type: string; 
      }): Promise<any> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}/payees`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payee)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            // Check for MFA requirement
            if (errorBody.connect_token) {
              const error: any = new Error('MFA_REQUIRED: Multi-factor authentication required');
              error.requiresConnectToken = errorBody.connect_token;
              error.mfaRequired = true;
              throw error;
            }
            
            const error: any = new Error(`Failed to create payee: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'payments.createPayee');
          }
          
          return await response.json();
        } catch (error: any) {
          if (error.mfaRequired) throw error;
          handleTellerError(error, 'payments.createPayee');
          throw error;
        }
      },
      
      /**
       * Initiate a payment (Zelle-based credit card payment)
       * Following: https://teller.io/docs/api/account/payments#initiate-a-payment
       * Supports idempotency with Idempotency-Key header
       */
      async create(accountId: string, payment: { 
        amount: string; 
        memo: string; 
        payee: any;
        idempotencyKey?: string;
      }): Promise<TellerPayment> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        
        // Add idempotency key if provided
        if (payment.idempotencyKey) {
          headers['Idempotency-Key'] = payment.idempotencyKey;
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}/payments`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              amount: payment.amount,
              memo: payment.memo,
              payee: payment.payee
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            // Check for MFA requirement
            if (errorBody.connect_token) {
              const error: any = new Error('MFA_REQUIRED: Multi-factor authentication required for payment');
              error.requiresConnectToken = errorBody.connect_token;
              error.mfaRequired = true;
              throw error;
            }
            
            const error: any = new Error(`Payment failed: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'payments.create');
          }
          
          return await response.json();
        } catch (error: any) {
          if (error.mfaRequired) throw error;
          handleTellerError(error, 'payments.create');
          throw error;
        }
      },
      
      /**
       * List all payments for an account
       * Following: https://teller.io/docs/api/account/payments#list-payments
       */
      async list(accountId: string): Promise<TellerPayment[]> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}/payments`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            const error: any = new Error(`Failed to list payments: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'payments.list');
          }
          
          const data = await response.json();
          return data || [];
        } catch (error: any) {
          handleTellerError(error, 'payments.list');
          throw error;
        }
      },
      
      /**
       * Get specific payment details
       * Following: https://teller.io/docs/api/account/payments#get-payment
       */
      async get(accountId: string, paymentId: string): Promise<TellerPayment> {
        const token = tokenMap.get(accountId);
        if (!token) {
          throw new Error(`No access token found for account ${accountId}`);
        }
        
        try {
          const response = await fetch(`https://api.teller.io/accounts/${accountId}/payments/${paymentId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorBody;
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              errorBody = { message: errorText };
            }
            
            const error: any = new Error(`Failed to fetch payment: ${response.status}`);
            error.response = { status: response.status };
            error.responseBody = errorBody;
            handleTellerError(error, 'payments.get');
          }
          
          return await response.json();
        } catch (error: any) {
          handleTellerError(error, 'payments.get');
          throw error;
        }
      }
    },
    
    // ===== IDENTITY API - FOLLOWING OFFICIAL TELLER DOCUMENTATION =====
    identity: {
      /**
       * Get identity information for all accounts
       * Following: https://teller.io/docs/api/identity#get-identity
       */
      async get(): Promise<TellerIdentity[]> {
        const allIdentities: TellerIdentity[] = [];
        
        // Get identity data for all available tokens
        const entries = Array.from(tokenMap.entries());
        for (const [accountId, token] of entries) {
          try {
            const response = await fetch(`https://api.teller.io/identity`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            
            if (response.ok) {
              const identities = await response.json();
              allIdentities.push(...identities);
            }
          } catch (error: any) {
            console.error(`[Teller API] Failed to fetch identity for token:`, error.message);
          }
        }
        
        return allIdentities;
      }
    }
  };
  
  return client;
}

// ===== HELPER UTILITIES =====

/**
 * Helper function to normalize account types
 */
export function toLower(str: string | undefined): string {
  return (str || '').toLowerCase();
}

/**
 * Check if account supports payments by examining links
 * Following Teller docs: check links.payments presence
 */
export function accountSupportsPayments(account: TellerAccount): boolean {
  return !!account.links?.payments;
}

/**
 * Check if account is eligible for Zelle payments
 * Following Teller docs: Zelle payments from checking accounts only
 */
export function accountSupportsZelle(account: TellerAccount): boolean {
  return account.type === 'depository' && 
         ['checking'].includes(account.subtype?.toLowerCase() || '') &&
         accountSupportsPayments(account);
}

/**
 * Format payment amount for Teller API
 * Following Teller docs: amount as dollars.cents string
 */
export function formatPaymentAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Validate Zelle address (email or phone)
 * Following Teller docs: address can be email or cellphone
 */
export function validateZelleAddress(address: string): { isValid: boolean; type: 'email' | 'phone' | 'unknown' } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  
  if (emailRegex.test(address)) {
    return { isValid: true, type: 'email' };
  }
  
  if (phoneRegex.test(address.replace(/[\s\-\(\)]/g, ''))) {
    return { isValid: true, type: 'phone' };
  }
  
  return { isValid: false, type: 'unknown' };
}

// ===== WEBHOOK UTILITIES =====

/**
 * Process Teller webhook events
 * Following: https://teller.io/docs/api/webhooks
 */
export function processTellerWebhook(webhook: TellerWebhook) {
  console.log('Processing Teller webhook:', {
    id: webhook.id,
    type: webhook.type,
    timestamp: webhook.timestamp
  });
  
  switch (webhook.type) {
    case 'enrollment.disconnected':
      console.log('Enrollment disconnected:', {
        enrollmentId: webhook.payload.enrollment_id,
        reason: webhook.payload.reason
      });
      // TODO: Update connection status in database
      // TODO: Notify user to reconnect
      break;
      
    case 'transactions.processed':
      console.log('Transactions processed:', {
        transactionCount: webhook.payload.transactions?.length || 0
      });
      // TODO: Update transaction data in database
      break;
      
    case 'account.number_verification.processed':
      console.log('Account verification processed:', {
        accountId: webhook.payload.account_id,
        status: webhook.payload.status
      });
      // TODO: Update verification status in database
      break;
      
    case 'webhook.test':
      console.log('Webhook test received successfully');
      break;
      
    default:
      console.log('Unknown webhook type:', webhook.type);
  }
}

/**
 * Generate idempotency key for payments
 * Following Teller docs: unique value per payment request
 */
export function generateIdempotencyKey(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
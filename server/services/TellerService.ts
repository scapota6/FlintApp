import { createHmac } from 'crypto';

// Teller.io API service implementation per official documentation
export class TellerService {
  private static readonly baseUrl = 'https://api.teller.io';
  private static readonly applicationId = process.env.TELLER_APPLICATION_ID;
  private static readonly signingSecret = process.env.TELLER_SIGNING_SECRET;
  private static readonly environment = process.env.TELLER_ENVIRONMENT || 'sandbox';

  // Validate environment variables
  static isConfigured(): boolean {
    return !!(this.applicationId && this.signingSecret);
  }

  // Generate Teller Connect URL for account linking
  static generateConnectUrl(userId: string, returnUrl?: string): string {
    if (!this.isConfigured()) {
      throw new Error('Teller configuration missing: TELLER_APPLICATION_ID and TELLER_SIGNING_SECRET required');
    }

    const params = new URLSearchParams({
      application_id: this.applicationId!,
      state: userId, // Pass user ID in state for linking after connection
      ...(returnUrl && { return_url: returnUrl })
    });

    return `https://teller.io/connect?${params.toString()}`;
  }

  // Exchange authorization code for access token
  static async exchangeToken(code: string): Promise<{
    accessToken: string;
    accountId: string;
    institutionName: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Teller configuration missing');
    }

    const response = await fetch(`${this.baseUrl}/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${code}:`).toString('base64')}`,
        'Accept': 'application/json',
        'User-Agent': 'FlintApp/1.0'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange token: ${error}`);
    }

    const accounts = await response.json();
    if (!accounts.length) {
      throw new Error('No accounts found after token exchange');
    }

    // Return the first account details
    const account = accounts[0];
    return {
      accessToken: code, // In Teller, the code IS the access token
      accountId: account.id,
      institutionName: account.institution.name
    };
  }

  // Get account details
  static async getAccount(accessToken: string, accountId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/accounts/${accountId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`,
        'Accept': 'application/json',
        'User-Agent': 'FlintApp/1.0'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get account: ${error}`);
    }

    return await response.json();
  }

  // Get account balance
  static async getAccountBalance(accessToken: string, accountId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/accounts/${accountId}/balances`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`,
        'Accept': 'application/json',
        'User-Agent': 'FlintApp/1.0'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get balance: ${error}`);
    }

    return await response.json();
  }

  // Get account transactions
  static async getTransactions(
    accessToken: string, 
    accountId: string, 
    options?: {
      count?: number;
      fromId?: string;
    }
  ): Promise<any[]> {
    const params = new URLSearchParams();
    if (options?.count) params.append('count', options.count.toString());
    if (options?.fromId) params.append('from_id', options.fromId);

    const url = `${this.baseUrl}/accounts/${accountId}/transactions${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`,
        'Accept': 'application/json',
        'User-Agent': 'FlintApp/1.0'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get transactions: ${error}`);
    }

    return await response.json();
  }

  // Create ACH transfer
  static async createTransfer(
    accessToken: string,
    accountId: string,
    transferData: {
      amount: string;
      description: string;
      counterparty: {
        name: string;
        account_number: string;
        routing_number: string;
      };
    }
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/accounts/${accountId}/transfers`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'FlintApp/1.0'
      },
      body: JSON.stringify(transferData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create transfer: ${error}`);
    }

    return await response.json();
  }

  // Get transfer status
  static async getTransfer(accessToken: string, accountId: string, transferId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/accounts/${accountId}/transfers/${transferId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`,
        'Accept': 'application/json',
        'User-Agent': 'FlintApp/1.0'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get transfer: ${error}`);
    }

    return await response.json();
  }

  // Verify webhook signature
  static verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.signingSecret) {
      console.warn('Teller signing secret not configured, skipping webhook verification');
      return false;
    }

    const expectedSignature = createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  // Disconnect account (revoke access)
  static async disconnectAccount(accessToken: string, accountId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/accounts/${accountId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`,
        'Accept': 'application/json',
        'User-Agent': 'FlintApp/1.0'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to disconnect account: ${error}`);
    }
  }

  // Get identity information
  static async getIdentity(accessToken: string, accountId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/accounts/${accountId}/identity`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`,
        'Accept': 'application/json',
        'User-Agent': 'FlintApp/1.0'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get identity: ${error}`);
    }

    return await response.json();
  }
}
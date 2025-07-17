import { apiRequest } from "./queryClient";

export interface TellerAccount {
  id: string;
  name: string;
  type: string;
  institution: string;
  balance: number;
  currency: string;
  accountNumber?: string;
  routingNumber?: string;
}

export interface TellerTransaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: string;
  category?: string;
  account_id: string;
}

export class TellerAPI {
  static async initiateTellerConnect() {
    const response = await apiRequest("POST", "/api/teller/connect-init");
    return response.json();
  }

  static async exchangeToken(token: string) {
    const response = await apiRequest("POST", "/api/teller/exchange-token", {
      token,
    });
    return response.json();
  }

  static async getAccounts(accessToken: string): Promise<TellerAccount[]> {
    const response = await apiRequest("GET", `/api/teller/accounts?token=${accessToken}`);
    return response.json();
  }

  static async getTransactions(accountId: string, accessToken: string): Promise<TellerTransaction[]> {
    const response = await apiRequest("GET", `/api/teller/transactions/${accountId}?token=${accessToken}`);
    return response.json();
  }

  static async syncAccount(accountId: string) {
    const response = await apiRequest("POST", `/api/teller/sync/${accountId}`);
    return response.json();
  }
}
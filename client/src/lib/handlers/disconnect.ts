import { postJson } from '@/lib/api';

export async function disconnectAccount(accountId: string, provider: 'teller' | 'snaptrade' = 'snaptrade') {
  const endpoint = provider === 'teller' 
    ? '/api/connections/disconnect/teller'
    : '/api/connections/disconnect/snaptrade';
    
  return postJson(endpoint, { accountId });
}

// Legacy support for banks endpoint
export async function disconnectBankAccount(accountId: string) {
  return postJson('/api/connections/disconnect/teller', { accountId });
}

// Support for brokerage accounts
export async function disconnectBrokerageAccount(accountId: string) {
  return postJson('/api/connections/disconnect/snaptrade', { accountId });
}
import { Router } from 'express';
import { authApi, accountsApi } from '../lib/snaptrade';
import { storage } from '../storage';

const router = Router();

// Get user's brokerage accounts
router.get('/accounts/brokerage', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = req.user!;
    console.log('Fetching brokerage accounts for user:', user.email);

    // Get user's SnapTrade credentials
    const userSecret = await storage.getUserSecret(user.id, 'snaptrade');
    if (!userSecret) {
      return res.json({ 
        brokerageAccounts: [],
        message: 'No brokerage accounts connected' 
      });
    }

    // Fetch accounts from SnapTrade
    const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
      userId: user.email,
      userSecret,
    });

    // Transform and enrich account data
    const brokerageAccounts = accountsResponse.data.map(account => ({
      id: account.id,
      accountNumber: account.account_number || 'N/A',
      accountType: account.account_type || 'brokerage',
      institutionName: account.institution_name || 'Unknown',
      balance: parseFloat(account.total_value?.amount || '0'),
      currency: account.total_value?.currency || 'USD',
      cash: parseFloat(account.cash?.amount || '0'),
      buyingPower: parseFloat(account.buying_power?.amount || '0'),
      isActive: account.sync_status?.is_syncing !== false,
      lastSynced: account.sync_status?.last_successful_sync || new Date().toISOString(),
    }));

    console.log('Found brokerage accounts:', brokerageAccounts.length);

    res.json({
      brokerageAccounts,
      count: brokerageAccounts.length,
    });

  } catch (error: any) {
    console.error('Error fetching brokerage accounts:', error);
    
    // Handle SnapTrade specific errors
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        message: 'SnapTrade authentication failed. Please reconnect your account.',
        error: 'SNAPTRADE_AUTH_FAILED',
      });
    }

    res.status(500).json({ 
      message: 'Failed to fetch brokerage accounts',
      error: error.message,
    });
  }
});

export default router;
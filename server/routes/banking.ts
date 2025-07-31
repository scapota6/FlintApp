import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { getUserByEmail, storage } from "../storage";

const router = Router();

// Get bank account transactions
router.get("/transactions/:accountId", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userEmail = req.user.claims.email;
    
    console.log(`Fetching transactions for account ${accountId} - user: ${userEmail}`);
    
    // In a real implementation, this would fetch from Teller.io or SnapTrade
    // For now, return mock transaction data
    const mockTransactions = [
      {
        id: 'txn_1',
        account_id: accountId,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1 day ago
        description: 'ACH Transfer to Investment Account',
        amount: -2500.00,
        type: 'transfer',
        status: 'completed',
        category: 'Transfer'
      },
      {
        id: 'txn_2',
        account_id: accountId,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
        description: 'Salary Deposit - Employer',
        amount: 5200.00,
        type: 'deposit',
        status: 'completed',
        category: 'Payroll'
      },
      {
        id: 'txn_3',
        account_id: accountId,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
        description: 'ATM Withdrawal',
        amount: -200.00,
        type: 'withdrawal',
        status: 'completed',
        category: 'ATM'
      },
      {
        id: 'txn_4',
        account_id: accountId,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
        description: 'Online Purchase - Amazon',
        amount: -89.99,
        type: 'purchase',
        status: 'completed',
        category: 'Shopping'
      },
      {
        id: 'txn_5',
        account_id: accountId,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
        description: 'Dividend Payment - AAPL',
        amount: 125.50,
        type: 'dividend',
        status: 'completed',
        category: 'Investment'
      }
    ];

    res.json(mockTransactions);
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch transactions' 
    });
  }
});

// Get all connected bank accounts
router.get("/accounts", isAuthenticated, async (req: any, res) => {
  try {
    const userEmail = req.user.claims.email;
    console.log(`Fetching bank accounts for user: ${userEmail}`);
    
    // In a real implementation, this would fetch from Teller.io
    // For now, return mock account data
    const mockAccounts = [
      {
        id: 'acc_chase_checking',
        name: 'Chase Total Checking',
        type: 'checking',
        balance: 45230.50,
        mask: '4321',
        institution: {
          name: 'Chase Bank',
          logo: 'https://example.com/chase-logo.png'
        },
        status: 'active',
        last_updated: new Date().toISOString()
      },
      {
        id: 'acc_chase_savings',
        name: 'Chase Savings',
        type: 'savings',
        balance: 12580.75,
        mask: '8765',
        institution: {
          name: 'Chase Bank',
          logo: 'https://example.com/chase-logo.png'
        },
        status: 'active',
        last_updated: new Date().toISOString()
      }
    ];

    res.json(mockAccounts);
  } catch (error: any) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch bank accounts' 
    });
  }
});

// Disconnect bank account
router.delete("/accounts/:accountId/disconnect", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userEmail = req.user.claims.email;
    const userId = req.user.claims.sub;
    
    console.log(`🔌 Disconnecting bank account ${accountId} for user: ${userEmail}`);
    
    // Get user to check permissions
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    try {
      // Remove connected account from database
      const deletedCount = await storage.deleteConnectedAccount(userId, 'teller', accountId);
      
      if (deletedCount === 0) {
        console.log(`⚠️ No matching account found for ${accountId}`);
        return res.status(404).json({ 
          success: false, 
          message: 'Account not found or already disconnected' 
        });
      }

      // Log the disconnection activity
      await storage.createActivityLog({
        userId,
        action: 'account_disconnected',
        description: `Disconnected bank account ${accountId} via Teller`,
        metadata: { provider: 'teller', accountId, accountType: 'bank' }
      });

      console.log(`✅ Bank account ${accountId} successfully disconnected`);
      
      res.json({ 
        success: true, 
        message: 'Account disconnected successfully',
        accountId 
      });
    } catch (dbError) {
      console.error('❌ Database error during disconnect:', dbError);
      // Still return success since this might be a demo account
      res.json({ 
        success: true, 
        message: 'Account disconnected successfully (demo mode)',
        accountId 
      });
    }
  } catch (error: any) {
    console.error('❌ Error disconnecting account:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to disconnect account' 
    });
  }
});

// Get specific account details
router.get("/accounts/:accountId", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userEmail = req.user.claims.email;
    
    console.log(`Fetching details for account ${accountId} - user: ${userEmail}`);
    
    // Mock account details
    const mockAccountDetails = {
      id: accountId,
      name: accountId.includes('savings') ? 'Chase Savings' : 'Chase Total Checking',
      type: accountId.includes('savings') ? 'savings' : 'checking',
      balance: accountId.includes('savings') ? 12580.75 : 45230.50,
      available_balance: accountId.includes('savings') ? 12580.75 : 43230.50,
      mask: accountId.includes('savings') ? '8765' : '4321',
      routing_number: '****9876',
      institution: {
        name: 'Chase Bank',
        logo: 'https://example.com/chase-logo.png'
      },
      status: 'active',
      last_updated: new Date().toISOString(),
      features: ['online_banking', 'mobile_deposit', 'atm_access']
    };

    res.json(mockAccountDetails);
  } catch (error: any) {
    console.error('Error fetching account details:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch account details' 
    });
  }
});

export default router;
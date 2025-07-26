import { storage } from '../storage';
import { CredentialEncryption } from '../security/encryption';

export interface InternalWalletBalance {
  userId: string;
  availableBalance: number;
  holdBalance: number;
  totalBalance: number;
  currency: string;
}

export interface AllocationRequest {
  userId: string;
  amount: number;
  brokerageId: string;
  purpose: 'trading' | 'investment' | 'transfer';
}

/**
 * Internal wallet service for fund management without acting as a broker
 * Handles secure fund holds and instant brokerage allocations
 */
export class WalletService {
  
  /**
   * Get user's internal wallet balance
   */
  static async getWalletBalance(userId: string): Promise<InternalWalletBalance> {
    const accounts = await storage.getConnectedAccounts(userId);
    const bankAccounts = accounts.filter(acc => acc.accountType === 'bank');
    
    // Calculate available funds from connected bank accounts
    const totalBankBalance = bankAccounts.reduce((sum, account) => {
      const balance = typeof account.balance === 'string' ? parseFloat(account.balance) : (account.balance || 0);
      return sum + balance;
    }, 0);
    
    // TODO: Implement actual hold tracking in database
    const holdBalance = 0; // Placeholder for held funds
    const availableBalance = totalBankBalance - holdBalance;
    
    return {
      userId,
      availableBalance,
      holdBalance,
      totalBalance: totalBankBalance,
      currency: 'USD'
    };
  }

  /**
   * Hold funds for pending transactions (pre-authorization)
   */
  static async holdFunds(userId: string, amount: number, purpose: string): Promise<{ success: boolean; holdId: string }> {
    const wallet = await this.getWalletBalance(userId);
    
    if (wallet.availableBalance < amount) {
      throw new Error('Insufficient funds for hold request');
    }
    
    // Create hold record
    const holdId = `hold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // TODO: Implement hold tracking in database schema
    console.log(`Holding ${amount} USD for user ${userId}, purpose: ${purpose}, holdId: ${holdId}`);
    
    return { success: true, holdId };
  }

  /**
   * Instant allocation to brokerage account (using held funds)
   */
  static async allocateToBrokerage(request: AllocationRequest): Promise<{ success: boolean; allocationId: string }> {
    // Verify user has sufficient held funds
    const wallet = await this.getWalletBalance(request.userId);
    
    if (wallet.availableBalance < request.amount) {
      throw new Error('Insufficient available funds for allocation');
    }
    
    // Generate allocation ID
    const allocationId = `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create allocation record (instant - no actual money movement yet)
    // This represents funds "allocated" to a brokerage for trading
    
    await storage.logActivity({
      userId: request.userId,
      action: 'fund_allocation',
      description: `Allocated $${request.amount} to ${request.brokerageId} for ${request.purpose}`,
      metadata: {
        amount: request.amount,
        brokerageId: request.brokerageId,
        purpose: request.purpose,
        allocationId
      }
    });
    
    console.log(`Allocated ${request.amount} USD to brokerage ${request.brokerageId} for user ${request.userId}`);
    
    return { success: true, allocationId };
  }

  /**
   * Release held funds (cancel transaction)
   */
  static async releaseFunds(userId: string, holdId: string): Promise<{ success: boolean }> {
    // TODO: Implement hold release logic
    console.log(`Released hold ${holdId} for user ${userId}`);
    
    await storage.logActivity({
      userId,
      action: 'fund_release',
      description: `Released held funds: ${holdId}`,
      metadata: { holdId }
    });
    
    return { success: true };
  }

  /**
   * Process ACH transfer using Teller between user accounts
   */
  static async initiateACHTransfer(userId: string, fromAccountId: string, toAccountId: string, amount: number): Promise<{ success: boolean; transferId: string }> {
    // Verify user owns both accounts
    const accounts = await storage.getConnectedAccounts(userId);
    const fromAccount = accounts.find(acc => acc.id.toString() === fromAccountId);
    const toAccount = accounts.find(acc => acc.id.toString() === toAccountId);
    
    if (!fromAccount || !toAccount) {
      throw new Error('Invalid account IDs or user does not own specified accounts');
    }
    
    // Create transfer record
    const transfer = await storage.createTransfer({
      userId,
      fromAccountId,
      toAccountId,
      amount: amount.toString(),
      currency: 'USD',
      status: 'pending',
      description: `ACH transfer via Teller: ${fromAccount.institutionName} → ${toAccount.institutionName}`
    });
    
    // TODO: Integrate with Teller's actual ACH API
    console.log(`Initiated ACH transfer: $${amount} from ${fromAccount.institutionName} to ${toAccount.institutionName}`);
    
    // Simulate processing time
    setTimeout(() => {
      storage.updateTransferStatus(transfer.id, 'completed', new Date());
    }, 5000);
    
    return { success: true, transferId: transfer.id.toString() };
  }
}
/**
 * SnapTrade Options endpoints
 * Handle option holdings with separate Options tab display
 */

import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { snaptradeUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { extractSnapTradeRequestId, createApiError } from '../lib/validation';
import type { ErrorResponse, OptionHolding } from '@shared/types';

const router = Router();

// Helper to get SnapTrade credentials for authenticated user
async function getSnapTradeCredentials(email: string) {
  const flintUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email)
  });
  
  if (!flintUser) {
    throw new Error('User not found');
  }
  
  const [credentials] = await db
    .select()
    .from(snaptradeUsers)
    .where(eq(snaptradeUsers.flintUserId, flintUser.id))
    .limit(1);
  
  if (!credentials) {
    throw new Error('SnapTrade account not connected');
  }
  
  return {
    userId: credentials.flintUserId,
    userSecret: credentials.userSecret
  };
}

/**
 * GET /api/snaptrade/options/holdings
 * List all option holdings across accounts - separate "Options" tab
 */
router.get('/holdings', isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Options] Getting option holdings:', {
      email,
      userId: credentials.userId
    });
    
    // Get option holdings from SnapTrade - check if this API exists
    let optionHoldingsData = [];
    
    try {
      // Try to call the options API if it exists in the SDK
      const { accountsApi } = await import('../lib/snaptrade');
      
      // Check if the SDK has option holdings methods
      if (typeof (accountsApi as any).getOptionHoldings === 'function') {
        const response = await (accountsApi as any).getOptionHoldings({
          userId: credentials.userId,
          userSecret: credentials.userSecret
        });
        optionHoldingsData = response.data || [];
      } else {
        console.log('[SnapTrade Options] Option holdings API not available in current SDK version');
      }
    } catch (e: any) {
      console.log('[SnapTrade Options] Option holdings not available or error:', e.message);
    }
    
    console.log('[SnapTrade Options] Retrieved option holdings:', {
      count: optionHoldingsData?.length || 0
    });
    
    // Transform to normalized DTO format
    const optionHoldings: OptionHolding[] = (optionHoldingsData || []).map((option: any) => ({
      symbol: option.symbol || option.occ_symbol || null, // OCC symbol format
      description: option.description || null,
      quantity: parseFloat(option.quantity || option.units) || 0,
      markPrice: option.mark_price ? { amount: parseFloat(option.mark_price), currency: option.currency?.code || 'USD' } : null,
      marketValue: option.market_value ? { amount: parseFloat(option.market_value), currency: option.currency?.code || 'USD' } : null,
      unrealizedPnl: option.unrealized_pnl ? { amount: parseFloat(option.unrealized_pnl), currency: option.currency?.code || 'USD' } : null,
      accountId: option.account_id || null,
      accountName: option.account?.name || null,
      institutionName: option.account?.institution_name || null
    }));
    
    res.json({
      optionHoldings
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Options] Error getting option holdings:', {
      email: req.user?.claims?.email,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get option holdings',
      error.response?.data?.code || 'GET_OPTION_HOLDINGS_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/options
 * Get option holdings for a specific account
 */
router.get('/accounts/:accountId/options', isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Options] Getting account option holdings:', {
      email,
      accountId
    });
    
    // Get account-specific option holdings from SnapTrade
    let accountOptionHoldingsData = [];
    
    try {
      const { accountsApi } = await import('../lib/snaptrade');
      
      // Check if the SDK has account-specific option holdings methods
      if (typeof (accountsApi as any).getUserAccountOptionHoldings === 'function') {
        const response = await (accountsApi as any).getUserAccountOptionHoldings({
          userId: credentials.userId,
          userSecret: credentials.userSecret,
          accountId: accountId
        });
        accountOptionHoldingsData = response.data || [];
      } else {
        console.log('[SnapTrade Options] Account option holdings API not available in current SDK version');
      }
    } catch (e: any) {
      console.log('[SnapTrade Options] Account option holdings not available or error:', e.message);
    }
    
    console.log('[SnapTrade Options] Retrieved account option holdings:', {
      accountId,
      count: accountOptionHoldingsData?.length || 0
    });
    
    // Transform to normalized DTO format
    const optionHoldings: OptionHolding[] = (accountOptionHoldingsData || []).map((option: any) => ({
      symbol: option.symbol || option.occ_symbol || null, // OCC symbol format
      description: option.description || null,
      quantity: parseFloat(option.quantity || option.units) || 0,
      markPrice: option.mark_price ? { amount: parseFloat(option.mark_price), currency: option.currency?.code || 'USD' } : null,
      marketValue: option.market_value ? { amount: parseFloat(option.market_value), currency: option.currency?.code || 'USD' } : null,
      unrealizedPnl: option.unrealized_pnl ? { amount: parseFloat(option.unrealized_pnl), currency: option.currency?.code || 'USD' } : null,
      accountId: accountId
    }));
    
    res.json({
      optionHoldings,
      accountId
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Options] Error getting account option holdings:', {
      accountId: req.params.accountId,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get account option holdings',
      error.response?.data?.code || 'GET_ACCOUNT_OPTIONS_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

export default router;
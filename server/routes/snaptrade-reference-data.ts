/**
 * SnapTrade Reference Data endpoints
 * Handle partner info, symbol search, security types, and instrument metadata
 */

import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { snaptradeUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { extractSnapTradeRequestId, createApiError } from '../lib/validation';
import type { ErrorResponse } from '@shared/types';

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
 * GET /api/snaptrade/reference/partner-info
 * Get partner information for admin diagnostics
 */
router.get('/partner-info', isAuthenticated, async (req: any, res) => {
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
    
    console.log('[SnapTrade Reference] Getting partner info for admin diagnostics:', {
      email
    });
    
    // Get partner info from SnapTrade
    const { referenceDataApi } = await import('../lib/snaptrade');
    const response = await referenceDataApi.getPartnerInfo();
    const partnerInfo = response.data;
    
    console.log('[SnapTrade Reference] Retrieved partner info:', {
      partnerName: partnerInfo?.name || 'Unknown',
      allowedBrokerages: partnerInfo?.allowed_brokerages?.length || 0
    });
    
    res.json({
      partnerInfo: {
        name: partnerInfo?.name || null,
        allowedBrokerages: partnerInfo?.allowed_brokerages || [],
        redirectUris: partnerInfo?.redirect_uris || [],
        logoUrl: partnerInfo?.logo_url || null,
        pinRequired: partnerInfo?.pin_required || false,
        canAccessTrades: partnerInfo?.can_access_trades || false,
        canAccessHoldings: partnerInfo?.can_access_holdings || false,
        canAccessAccountHistory: partnerInfo?.can_access_account_history || false,
        canAccessReferenceData: partnerInfo?.can_access_reference_data || false,
        canAccessPortfolioManagement: partnerInfo?.can_access_portfolio_management || false,
        canAccessOrders: partnerInfo?.can_access_orders || false
      }
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Reference] Error getting partner info:', {
      email: req.user?.claims?.email,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get partner info',
      error.response?.data?.code || 'GET_PARTNER_INFO_ERROR',
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
 * GET /api/snaptrade/reference/symbol-search
 * Symbol search for trading
 * Query params: substring, userAccountId (optional)
 */
router.get('/symbol-search', isAuthenticated, async (req: any, res) => {
  try {
    const { substring, userAccountId } = req.query;
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
    
    if (!substring) {
      return res.status(400).json({
        error: {
          code: 'MISSING_SUBSTRING',
          message: 'Search substring required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Reference] Symbol search:', {
      email,
      substring,
      userAccountId: userAccountId || 'all accounts'
    });
    
    // Perform symbol search
    const { referenceDataApi } = await import('../lib/snaptrade');
    
    let searchResults = [];
    if (userAccountId) {
      // Search within a specific user account
      const response = await referenceDataApi.symbolSearchUserAccount({
        userId: credentials.userId,
        userSecret: credentials.userSecret,
        accountId: userAccountId,
        substring: substring
      });
      searchResults = response.data || [];
    } else {
      // General symbol search (if available)
      try {
        const response = await referenceDataApi.getSymbolsByTicker({
          query: substring
        });
        searchResults = response.data || [];
      } catch (e: any) {
        console.log('[SnapTrade Reference] General symbol search not available, trying user account search');
        // Fallback: if no general search, we'd need an account ID
        return res.status(400).json({
          error: {
            code: 'ACCOUNT_REQUIRED',
            message: 'Account ID required for symbol search in this SnapTrade configuration',
            requestId: null
          }
        });
      }
    }
    
    console.log('[SnapTrade Reference] Symbol search results:', {
      substring,
      count: searchResults?.length || 0
    });
    
    // Transform to normalized DTO format
    const symbols = (searchResults || []).map((result: any) => ({
      symbol: result.symbol || null,
      description: result.description || result.name || null,
      currency: result.currency?.code || 'USD',
      exchange: result.exchange?.name || null,
      type: result.type?.description || result.security_type || null,
      isTradable: result.is_tradable !== false, // default true
      ficgiCode: result.figi_code || null,
      instrumentId: result.id || null
    }));
    
    res.json({
      symbols,
      query: substring,
      userAccountId: userAccountId || null
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Reference] Error in symbol search:', {
      email: req.user?.claims?.email,
      substring: req.query.substring,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Symbol search failed',
      error.response?.data?.code || 'SYMBOL_SEARCH_ERROR',
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
 * GET /api/snaptrade/reference/security-types
 * Get available security types for humanized display
 */
router.get('/security-types', isAuthenticated, async (req: any, res) => {
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
    
    console.log('[SnapTrade Reference] Getting security types:', {
      email
    });
    
    // Get security types from SnapTrade
    const { referenceDataApi } = await import('../lib/snaptrade');
    const response = await referenceDataApi.getSecurityTypes();
    const securityTypes = response.data || [];
    
    console.log('[SnapTrade Reference] Retrieved security types:', {
      count: securityTypes?.length || 0
    });
    
    // Transform to normalized DTO format for humanized display
    const types = securityTypes.map((type: any) => ({
      id: type.id || null,
      code: type.code || null,
      description: type.description || null,
      isSupported: type.is_supported !== false // default true
    }));
    
    res.json({
      securityTypes: types
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Reference] Error getting security types:', {
      email: req.user?.claims?.email,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get security types',
      error.response?.data?.code || 'GET_SECURITY_TYPES_ERROR',
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
 * GET /api/snaptrade/reference/symbols/:ticker
 * Get detailed symbol information by ticker
 */
router.get('/symbols/:ticker', isAuthenticated, async (req: any, res) => {
  try {
    const { ticker } = req.params;
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
    
    console.log('[SnapTrade Reference] Getting symbol details:', {
      email,
      ticker
    });
    
    // Get symbol details from SnapTrade
    const { referenceDataApi } = await import('../lib/snaptrade');
    const response = await referenceDataApi.getSymbolsByTicker({
      query: ticker
    });
    const symbols = response.data || [];
    
    console.log('[SnapTrade Reference] Retrieved symbol details:', {
      ticker,
      count: symbols?.length || 0
    });
    
    // Find exact match or return first result
    const symbol = symbols.find((s: any) => 
      s.symbol?.toUpperCase() === ticker.toUpperCase()
    ) || symbols[0];
    
    if (!symbol) {
      return res.status(404).json({
        error: {
          code: 'SYMBOL_NOT_FOUND',
          message: `Symbol ${ticker} not found`,
          requestId: null
        }
      });
    }
    
    // Transform to normalized DTO format
    const symbolDetails = {
      symbol: symbol.symbol || null,
      description: symbol.description || symbol.name || null,
      currency: symbol.currency?.code || 'USD',
      exchange: symbol.exchange?.name || null,
      type: symbol.type?.description || symbol.security_type || null,
      isTradable: symbol.is_tradable !== false,
      ficgiCode: symbol.figi_code || null,
      instrumentId: symbol.id || null,
      raw: symbol // Include raw data for enriching instrument cards
    };
    
    res.json({
      symbol: symbolDetails,
      ticker
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Reference] Error getting symbol details:', {
      email: req.user?.claims?.email,
      ticker: req.params.ticker,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get symbol details',
      error.response?.data?.code || 'GET_SYMBOL_ERROR',
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
 * GET /api/snaptrade/reference/instruments/:brokerage
 * Background index cache for all brokerage instruments
 * This is for background caching - could be resource intensive
 */
router.get('/instruments/:brokerage', isAuthenticated, async (req: any, res) => {
  try {
    const { brokerage } = req.params;
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
    
    console.log('[SnapTrade Reference] Getting all brokerage instruments (background cache):', {
      email,
      brokerage
    });
    
    // Get all brokerage instruments from SnapTrade
    const { referenceDataApi } = await import('../lib/snaptrade');
    const response = await referenceDataApi.listAllBrokerageInstruments({
      brokerage: brokerage
    });
    const instruments = response.data || [];
    
    console.log('[SnapTrade Reference] Retrieved brokerage instruments:', {
      brokerage,
      count: instruments?.length || 0
    });
    
    // Transform to normalized DTO format
    const instrumentsList = (instruments || []).map((instrument: any) => ({
      id: instrument.id || null,
      symbol: instrument.symbol || null,
      description: instrument.description || instrument.name || null,
      currency: instrument.currency?.code || 'USD',
      exchange: instrument.exchange?.name || null,
      type: instrument.type?.description || instrument.security_type || null,
      isTradable: instrument.is_tradable !== false,
      ficgiCode: instrument.figi_code || null
    }));
    
    res.json({
      instruments: instrumentsList,
      brokerage,
      count: instrumentsList.length,
      cached: true // Mark as cacheable for background indexing
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Reference] Error getting brokerage instruments:', {
      email: req.user?.claims?.email,
      brokerage: req.params.brokerage,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get brokerage instruments',
      error.response?.data?.code || 'GET_INSTRUMENTS_ERROR',
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
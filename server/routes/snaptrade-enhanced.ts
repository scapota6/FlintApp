import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { v4 as uuidv4 } from 'uuid';

// Import SnapTrade SDK
import { Snaptrade } from 'snaptrade-typescript-sdk';

const router = Router();

// Initialize SnapTrade SDK
const snaptrade = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID || '',
  consumerKey: process.env.SNAPTRADE_CLIENT_SECRET || '',
});

// 1. Register user and create connection portal
router.post("/register", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const email = req.user.claims.email;

    console.log(`SnapTrade registration for user ${userId}`);

    // Check if user already has SnapTrade credentials
    const existingUser = await storage.getSnapTradeUser(userId);
    
    let snaptradeUserId: string;
    let userSecret: string;

    if (existingUser && existingUser.snaptradeUserId && existingUser.userSecret) {
      // User already registered
      snaptradeUserId = existingUser.snaptradeUserId;
      userSecret = existingUser.userSecret;
      console.log(`Using existing SnapTrade user: ${snaptradeUserId}`);
    } else {
      // Register new SnapTrade user
      const registerResponse = await snaptrade.authentication.registerSnapTradeUser({
        userId: email || userId, // Use email as preferred identifier
      });

      if (!registerResponse.data?.userSecret) {
        throw new Error('Failed to register SnapTrade user - no userSecret returned');
      }

      snaptradeUserId = email || userId;
      userSecret = registerResponse.data.userSecret;

      // Store credentials in database
      await storage.createSnapTradeUser(userId, snaptradeUserId, userSecret);
      console.log(`Created new SnapTrade user: ${snaptradeUserId}`);
    }

    // Generate connection portal URL
    const portalResponse = await snaptrade.authentication.loginSnapTradeUser({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    if (!portalResponse.data?.redirectURI) {
      throw new Error('Failed to generate connection portal URL');
    }

    res.json({
      success: true,
      url: portalResponse.data.redirectURI,
      snaptradeUserId,
    });

  } catch (error: any) {
    console.error('SnapTrade registration error:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register SnapTrade user',
    });
  }
});

// 2. Get user's brokerage connections and accounts
router.get("/connections", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Get stored brokerage connections
    const connections = await storage.getBrokerageConnections(userId);
    
    // Get SnapTrade credentials
    const snaptradeUser = await storage.getSnapTradeUser(userId);
    
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser.userSecret) {
      return res.json({
        success: true,
        connections: [],
        message: "Please connect your brokerage account first"
      });
    }

    // Fetch live account data from SnapTrade
    const accountsResponse = await snaptrade.accountInformation.getAllUserAccounts({
      userId: snaptradeUser.snaptradeUserId,
      userSecret: snaptradeUser.userSecret,
    });

    const accounts = accountsResponse.data || [];

    // Update our database with current account information
    for (const account of accounts) {
      // Find or create connection
      let connection = connections.find(c => 
        c.snaptradeConnectionId === account.brokerage_authorization?.id
      );

      if (!connection && account.brokerage_authorization) {
        connection = await storage.createBrokerageConnection({
          userId,
          snaptradeConnectionId: account.brokerage_authorization.id,
          brokerageName: account.brokerage_authorization.name || 'Unknown',
          brokerageSlug: account.brokerage_authorization.slug,
          accountType: account.meta?.type,
          metadata: { brokerage_authorization: account.brokerage_authorization },
        });
      }

      if (connection) {
        // Update or create account
        const existingAccounts = await storage.getBrokerageAccounts(connection.id);
        const existingAccount = existingAccounts.find(a => 
          a.snaptradeAccountId === account.id
        );

        if (!existingAccount) {
          await storage.createBrokerageAccount({
            connectionId: connection.id,
            snaptradeAccountId: account.id,
            accountNumber: account.number,
            accountName: account.name,
            accountType: account.meta?.type,
            balance: account.cash_restrictions?.[0]?.total?.toString(),
            buyingPower: account.cash_restrictions?.[0]?.buying_power?.toString(),
            currency: account.cash_restrictions?.[0]?.currency,
            metadata: { account_meta: account.meta, cash_restrictions: account.cash_restrictions },
          });
        } else {
          // Update existing account
          await storage.updateBrokerageAccount(existingAccount.id, {
            balance: account.cash_restrictions?.[0]?.total?.toString(),
            buyingPower: account.cash_restrictions?.[0]?.buying_power?.toString(),
            metadata: { account_meta: account.meta, cash_restrictions: account.cash_restrictions },
          });
        }
      }
    }

    // Return updated connections with account details
    const updatedConnections = await storage.getBrokerageConnections(userId);
    const connectionsWithAccounts = await Promise.all(
      updatedConnections.map(async (connection) => {
        const accounts = await storage.getBrokerageAccounts(connection.id);
        return { ...connection, accounts };
      })
    );

    res.json({
      success: true,
      connections: connectionsWithAccounts,
      snaptradeAccounts: accounts,
    });

  } catch (error: any) {
    console.error('Error fetching connections:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch connections',
    });
  }
});

// 3. Get account balances and positions
router.get("/accounts/:accountId/details", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { accountId } = req.params;

    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser.userSecret) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    // Get account balances
    const balancesResponse = await snaptrade.accountInformation.getAccountBalances({
      userId: snaptradeUser.snaptradeUserId,
      userSecret: snaptradeUser.userSecret,
      accountId,
    });

    // Get account positions
    const positionsResponse = await snaptrade.accountInformation.getAccountPositions({
      userId: snaptradeUser.snaptradeUserId,
      userSecret: snaptradeUser.userSecret,
      accountId,
    });

    res.json({
      success: true,
      balances: balancesResponse.data,
      positions: positionsResponse.data,
    });

  } catch (error: any) {
    console.error('Error fetching account details:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch account details',
    });
  }
});

// 4. Search symbols for trading
router.get("/symbols/search", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { query, accountId } = req.query;

    if (!query || !accountId) {
      return res.status(400).json({ message: "Query and accountId required" });
    }

    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser.userSecret) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    // Search account symbols
    const symbolsResponse = await snaptrade.accountInformation.getAccountOrdersSymbols({
      userId: snaptradeUser.snaptradeUserId,
      userSecret: snaptradeUser.userSecret,
      accountId: accountId as string,
    });

    // Filter symbols based on query
    const filteredSymbols = (symbolsResponse.data || []).filter((symbol: any) =>
      symbol.symbol?.toLowerCase().includes((query as string).toLowerCase()) ||
      symbol.description?.toLowerCase().includes((query as string).toLowerCase())
    );

    res.json({
      success: true,
      symbols: filteredSymbols.slice(0, 10), // Limit to 10 results
    });

  } catch (error: any) {
    console.error('Error searching symbols:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search symbols',
    });
  }
});

// 5. Get order impact (preview)
router.post("/orders/preview", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { accountId, symbol, quantity, side, orderType, timeInForce = "GTC" } = req.body;

    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser.userSecret) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    // Check order impact
    const impactResponse = await snaptrade.trading.getOrderImpact({
      userId: snaptradeUser.snaptradeUserId,
      userSecret: snaptradeUser.userSecret,
      accountId,
      action: side.toUpperCase(),
      orderType: orderType.charAt(0).toUpperCase() + orderType.slice(1).toLowerCase(),
      quantity: parseInt(quantity),
      price: req.body.price,
      stop: req.body.stop,
      timeInForce,
      units: parseInt(quantity),
      universalSymbolId: symbol, // This should be the universal_symbol_id from symbol search
    });

    res.json({
      success: true,
      impact: impactResponse.data,
    });

  } catch (error: any) {
    console.error('Error getting order preview:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to preview order',
    });
  }
});

// 6. Place order
router.post("/orders/place", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { accountId, symbol, quantity, side, orderType, price, timeInForce = "GTC" } = req.body;

    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser.userSecret) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    // Create trading order record
    const orderRecord = await storage.createTradingOrder({
      userId,
      accountId,
      symbol,
      side: side.toUpperCase(),
      orderType: orderType.charAt(0).toUpperCase() + orderType.slice(1).toLowerCase(),
      quantity: quantity.toString(),
      price: price?.toString(),
      status: "PENDING",
      metadata: { timeInForce, snaptradeUserId: snaptradeUser.snaptradeUserId },
    });

    // Place order with SnapTrade
    const orderResponse = await snaptrade.trading.placeForceOrder({
      userId: snaptradeUser.snaptradeUserId,
      userSecret: snaptradeUser.userSecret,
      accountId,
      action: side.toUpperCase(),
      orderType: orderType.charAt(0).toUpperCase() + orderType.slice(1).toLowerCase(),
      quantity: parseInt(quantity),
      price: parseFloat(price),
      timeInForce,
      units: parseInt(quantity),
      universalSymbolId: symbol,
    });

    // Update order record with SnapTrade order ID
    if (orderResponse.data?.id) {
      await storage.updateTradingOrder(orderRecord.id, {
        snaptradeOrderId: orderResponse.data.id,
        status: orderResponse.data.status || "SUBMITTED",
        metadata: { 
          ...orderRecord.metadata, 
          snaptradeOrder: orderResponse.data 
        },
      });
    }

    res.json({
      success: true,
      order: orderResponse.data,
      localOrderId: orderRecord.id,
    });

  } catch (error: any) {
    console.error('Error placing order:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to place order',
    });
  }
});

// 7. Get order history
router.get("/orders", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { limit = 50 } = req.query;

    // Get local order history
    const orders = await storage.getTradingOrders(userId, parseInt(limit as string));

    // Get live SnapTrade order updates
    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (snaptradeUser?.snaptradeUserId && snaptradeUser.userSecret) {
      // Get all accounts for this user
      const accounts = await storage.getAllBrokerageAccounts(userId);
      
      for (const account of accounts) {
        try {
          const activitiesResponse = await snaptrade.accountInformation.getAccountActivities({
            userId: snaptradeUser.snaptradeUserId,
            userSecret: snaptradeUser.userSecret,
            accountId: account.snaptradeAccountId,
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
          });

          // Update local order statuses based on SnapTrade activities
          for (const activity of activitiesResponse.data || []) {
            if (activity.type && ['BUY', 'SELL'].includes(activity.type)) {
              const localOrder = orders.find(o => 
                o.snaptradeOrderId === activity.id ||
                (o.symbol === activity.symbol && Math.abs(parseFloat(o.quantity || "0") - (activity.quantity || 0)) < 0.01)
              );

              if (localOrder && activity.status !== localOrder.status) {
                await storage.updateTradingOrder(localOrder.id, {
                  status: activity.status || "UNKNOWN",
                  executedAt: activity.settlement_date ? new Date(activity.settlement_date) : undefined,
                });
              }
            }
          }
        } catch (accountError) {
          console.log(`Error fetching activities for account ${account.snaptradeAccountId}:`, accountError);
        }
      }
    }

    // Return updated orders
    const updatedOrders = await storage.getTradingOrders(userId, parseInt(limit as string));

    res.json({
      success: true,
      orders: updatedOrders,
    });

  } catch (error: any) {
    console.error('Error fetching orders:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders',
    });
  }
});

// 8. Manual refresh endpoint
router.post("/refresh", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser.userSecret) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    // Trigger manual refresh of user's data
    await snaptrade.accountInformation.getAllUserAccounts({
      userId: snaptradeUser.snaptradeUserId,
      userSecret: snaptradeUser.userSecret,
    });

    res.json({
      success: true,
      message: "Refresh triggered successfully",
    });

  } catch (error: any) {
    console.error('Error triggering refresh:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to trigger refresh',
    });
  }
});

// 9. Disconnect brokerage connection
router.delete("/connections/:connectionId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { connectionId } = req.params;

    // Verify connection belongs to user
    const connections = await storage.getBrokerageConnections(userId);
    const connection = connections.find(c => c.id === connectionId);

    if (!connection) {
      return res.status(404).json({ message: "Connection not found" });
    }

    // Delete from database (cascades to accounts)
    await storage.deleteBrokerageConnection(connectionId);

    res.json({
      success: true,
      message: "Connection removed successfully",
    });

  } catch (error: any) {
    console.error('Error removing connection:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove connection',
    });
  }
});

export default router;
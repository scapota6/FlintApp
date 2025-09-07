import { Router } from "express";
import { isAdmin } from "../middleware/adminAuth";
import { storage } from "../storage";
import { logger } from "@shared/logger";
import { z } from "zod";
import { db } from "../db";
import { eq, desc, sql, and, or } from "drizzle-orm";
import { users, connectedAccounts, snaptradeUsers, activityLog, holdings } from "@shared/schema";
import { deleteSnapUser } from "../store/snapUsers";

const router = Router();

// Admin Dashboard Statistics
router.get("/stats", isAdmin, async (req, res) => {
  try {
    // Get total users count
    const totalUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    const totalUsers = Number(totalUsersResult[0]?.count || 0);

    // Get subscription distribution
    const subscriptionStats = await db
      .select({
        tier: users.subscriptionTier,
        count: sql<number>`count(*)`
      })
      .from(users)
      .groupBy(users.subscriptionTier);

    // Get connected accounts stats
    const accountStats = await db
      .select({
        provider: connectedAccounts.provider,
        accountType: connectedAccounts.accountType,
        count: sql<number>`count(*)`
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.isActive, true))
      .groupBy(connectedAccounts.provider, connectedAccounts.accountType);

    // Get recent activity
    const recentActivity = await db
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(10);

    // Get banned users count
    const bannedUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isBanned, true));
    const bannedUsers = Number(bannedUsersResult[0]?.count || 0);

    res.json({
      totalUsers,
      activeUsers: totalUsers - bannedUsers,
      bannedUsers,
      subscriptionStats: subscriptionStats.reduce((acc, stat) => {
        acc[stat.tier || 'free'] = Number(stat.count);
        return acc;
      }, {} as Record<string, number>),
      accountStats: accountStats.map(stat => ({
        provider: stat.provider,
        accountType: stat.accountType,
        count: Number(stat.count)
      })),
      recentActivity
    });
  } catch (error) {
    logger.error("Admin stats error:", error);
    res.status(500).json({ message: "Failed to fetch admin statistics" });
  }
});

// Get all users with pagination and filtering
router.get("/users", isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const tier = req.query.tier as string;
    const status = req.query.status as string;

    // Build where conditions
    const conditions = [];
    if (search) {
      conditions.push(
        or(
          sql`${users.email} ILIKE ${'%' + search + '%'}`,
          sql`${users.firstName} ILIKE ${'%' + search + '%'}`,
          sql`${users.lastName} ILIKE ${'%' + search + '%'}`
        )
      );
    }
    if (tier) {
      conditions.push(eq(users.subscriptionTier, tier));
    }
    if (status === 'banned') {
      conditions.push(eq(users.isBanned, true));
    } else if (status === 'active') {
      conditions.push(eq(users.isBanned, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get users with their connected accounts count
    const usersData = await db
      .select({
        user: users,
        connectedAccountsCount: sql<number>`(
          SELECT COUNT(*) FROM ${connectedAccounts} 
          WHERE ${connectedAccounts.userId} = ${users.id} 
          AND ${connectedAccounts.isActive} = true
        )`
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);
    const total = Number(totalResult[0]?.count || 0);

    res.json({
      users: usersData.map(row => ({
        ...row.user,
        connectedAccountsCount: Number(row.connectedAccountsCount)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error("Admin get users error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Get user details including connected accounts
router.get("/users/:userId", isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user details
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get connected accounts
    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    // Get SnapTrade user if exists
    const snaptradeUser = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, userId))
      .limit(1);

    // Get user activity
    const activity = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.userId, userId))
      .orderBy(desc(activityLog.createdAt))
      .limit(20);

    res.json({
      user,
      connectedAccounts: accounts,
      hasSnapTrade: snaptradeUser.length > 0,
      recentActivity: activity
    });
  } catch (error) {
    logger.error("Admin get user details error:", error);
    res.status(500).json({ message: "Failed to fetch user details" });
  }
});

// Update user subscription
const updateSubscriptionSchema = z.object({
  subscriptionTier: z.enum(['free', 'basic', 'pro', 'premium']),
  subscriptionStatus: z.enum(['active', 'cancelled', 'expired']).optional()
});

router.patch("/users/:userId/subscription", isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const data = updateSubscriptionSchema.parse(req.body);

    // Update user subscription
    const updated = await db
      .update(users)
      .set({
        subscriptionTier: data.subscriptionTier,
        subscriptionStatus: data.subscriptionStatus || 'active',
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated.length) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log admin action
    await storage.logActivity({
      userId: (req as any).adminUser.id,
      action: 'admin_subscription_update',
      description: `Updated subscription for user ${userId} to ${data.subscriptionTier}`,
      metadata: {
        targetUserId: userId,
        newTier: data.subscriptionTier,
        newStatus: data.subscriptionStatus
      }
    });

    res.json({ 
      message: "Subscription updated successfully",
      user: updated[0]
    });
  } catch (error) {
    logger.error("Admin update subscription error:", error);
    res.status(500).json({ message: "Failed to update subscription" });
  }
});

// Ban/Unban user
router.patch("/users/:userId/ban", isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { ban } = req.body;

    if (typeof ban !== 'boolean') {
      return res.status(400).json({ message: "Invalid ban status" });
    }

    // Prevent admin from banning themselves
    if (userId === (req as any).adminUser.id) {
      return res.status(400).json({ message: "Cannot ban yourself" });
    }

    const updated = await db
      .update(users)
      .set({
        isBanned: ban,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated.length) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log admin action
    await storage.logActivity({
      userId: (req as any).adminUser.id,
      action: ban ? 'admin_ban_user' : 'admin_unban_user',
      description: `${ban ? 'Banned' : 'Unbanned'} user ${userId}`,
      metadata: {
        targetUserId: userId,
        banned: ban
      }
    });

    res.json({ 
      message: `User ${ban ? 'banned' : 'unbanned'} successfully`,
      user: updated[0]
    });
  } catch (error) {
    logger.error("Admin ban/unban error:", error);
    res.status(500).json({ message: "Failed to update ban status" });
  }
});

// Disconnect user's connected account
router.delete("/users/:userId/accounts/:accountId", isAdmin, async (req, res) => {
  try {
    const { userId, accountId } = req.params;

    // Verify account belongs to user
    const account = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.id, parseInt(accountId)),
          eq(connectedAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!account.length) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Soft delete the account
    await db
      .update(connectedAccounts)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(connectedAccounts.id, parseInt(accountId)));

    // Log admin action
    await storage.logActivity({
      userId: (req as any).adminUser.id,
      action: 'admin_disconnect_account',
      description: `Disconnected account ${account[0].accountName} for user ${userId}`,
      metadata: {
        targetUserId: userId,
        accountId: accountId,
        accountName: account[0].accountName,
        provider: account[0].provider
      }
    });

    res.json({ message: "Account disconnected successfully" });
  } catch (error) {
    logger.error("Admin disconnect account error:", error);
    res.status(500).json({ message: "Failed to disconnect account" });
  }
});

// Make user an admin
router.patch("/users/:userId/admin", isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAdmin: makeAdmin } = req.body;

    if (typeof makeAdmin !== 'boolean') {
      return res.status(400).json({ message: "Invalid admin status" });
    }

    const updated = await db
      .update(users)
      .set({
        isAdmin: makeAdmin,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated.length) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log admin action
    await storage.logActivity({
      userId: (req as any).adminUser.id,
      action: makeAdmin ? 'admin_grant_admin' : 'admin_revoke_admin',
      description: `${makeAdmin ? 'Granted' : 'Revoked'} admin privileges for user ${userId}`,
      metadata: {
        targetUserId: userId,
        adminStatus: makeAdmin
      }
    });

    res.json({ 
      message: `Admin privileges ${makeAdmin ? 'granted' : 'revoked'} successfully`,
      user: updated[0]
    });
  } catch (error) {
    logger.error("Admin update admin status error:", error);
    res.status(500).json({ message: "Failed to update admin status" });
  }
});

// Get platform activity logs
router.get("/activity", isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const action = req.query.action as string;
    const userId = req.query.userId as string;

    // Build where conditions
    const conditions = [];
    if (action) {
      conditions.push(eq(activityLog.action, action));
    }
    if (userId) {
      conditions.push(eq(activityLog.userId, userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get activity logs with user info
    const logs = await db
      .select({
        log: activityLog,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName
        }
      })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.userId, users.id))
      .where(whereClause)
      .orderBy(desc(activityLog.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityLog)
      .where(whereClause);
    const total = Number(totalResult[0]?.count || 0);

    res.json({
      logs: logs.map(row => ({
        ...row.log,
        user: row.user
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error("Admin get activity logs error:", error);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
});

// Reset user's SnapTrade connections
router.post("/users/:userId/reset-snaptrade", isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 1. Clear file-based SnapTrade user storage
    await deleteSnapUser(userId);

    // 2. Reset database SnapTrade credentials
    await db
      .update(users)
      .set({
        snaptradeUserId: null,
        snaptradeUserSecret: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // 3. Soft delete connected SnapTrade accounts
    const snaptradeAccounts = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, userId),
          eq(connectedAccounts.provider, 'snaptrade')
        )
      );

    if (snaptradeAccounts.length > 0) {
      await db
        .update(connectedAccounts)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(connectedAccounts.userId, userId),
            eq(connectedAccounts.provider, 'snaptrade')
          )
        );

      // 4. Clear holdings for those accounts
      const accountIds = snaptradeAccounts.map(acc => acc.id);
      if (accountIds.length > 0) {
        await db
          .delete(holdings)
          .where(
            sql`${holdings.accountId} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`
          );
      }
    }

    // 5. Remove from SnapTrade users table
    await db
      .delete(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, userId));

    // Log admin action
    await storage.logActivity({
      userId: (req as any).adminUser.id,
      action: 'admin_reset_snaptrade',
      description: `Reset SnapTrade connections for user ${user.email}`,
      metadata: {
        targetUserId: userId,
        targetUserEmail: user.email,
        accountsReset: snaptradeAccounts.length
      }
    });

    res.json({ 
      message: "SnapTrade connections reset successfully",
      accountsReset: snaptradeAccounts.length
    });
  } catch (error) {
    logger.error("Admin reset SnapTrade error:", error);
    res.status(500).json({ message: "Failed to reset SnapTrade connections" });
  }
});

export default router;
import { Router } from 'express';
import { authApi } from '../lib/snaptrade';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { users, snaptradeUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Helper function to get Flint user by auth claims
async function getFlintUserByAuth(authUser: any) {
  const email = authUser?.claims?.email?.toLowerCase();
  if (!email) throw new Error('User email required');
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  if (!user) throw new Error('User not found');
  return user;
}

// Helper function to get existing SnapTrade credentials
async function getSnaptradeCredentials(flintUserId: string) {
  const [credentials] = await db
    .select()
    .from(snaptradeUsers)
    .where(eq(snaptradeUsers.flintUserId, flintUserId))
    .limit(1);
  
  return credentials || null;
}

// Helper function to save SnapTrade credentials
async function saveSnaptradeCredentials(flintUserId: string, snaptradeUserId: string, snaptradeUserSecret: string) {
  await db
    .insert(snaptradeUsers)
    .values({
      flintUserId,
      snaptradeUserId,
      snaptradeUserSecret,
      connectedAt: new Date(),
      lastSyncAt: new Date()
    })
    .onConflictDoUpdate({
      target: snaptradeUsers.flintUserId,
      set: {
        snaptradeUserId,
        snaptradeUserSecret,
        lastSyncAt: new Date()
      }
    });
}

/**
 * POST /api/snaptrade/users/register
 * Register user with SnapTrade (idempotent - won't re-register if already exists)
 */
router.post('/register', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const flintUserId = flintUser.id;
    
    console.log('[SnapTrade Users] Register request for flintUserId:', flintUserId);
    
    // Check if user already exists
    const existingCredentials = await getSnaptradeCredentials(flintUserId);
    if (existingCredentials?.snaptradeUserSecret) {
      console.log('[SnapTrade Users] User already registered, reusing credentials');
      return res.json({
        success: true,
        message: 'User already registered',
        userId: existingCredentials.snaptradeUserId,
        registered: true
      });
    }
    
    // Register new user with SnapTrade
    console.log('[SnapTrade Users] Registering new user with SnapTrade...');
    const registration = await authApi.registerSnapTradeUser({
      userId: flintUserId // Use Flint user ID as SnapTrade user ID
    });
    
    const snaptradeUserId = registration.data.userId!;
    const snaptradeUserSecret = registration.data.userSecret!;
    
    if (!snaptradeUserSecret) {
      throw new Error('SnapTrade did not return userSecret');
    }
    
    // Save credentials to database
    await saveSnaptradeCredentials(flintUserId, snaptradeUserId, snaptradeUserSecret);
    
    console.log('[SnapTrade Users] Registration successful:', {
      flintUserId,
      snaptradeUserId,
      secretLength: snaptradeUserSecret.length
    });
    
    res.json({
      success: true,
      message: 'User registered successfully',
      userId: snaptradeUserId,
      registered: true
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Users] Registration error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to register user with SnapTrade'
    });
  }
});

/**
 * GET /api/snaptrade/users (admin only)
 * List all SnapTrade users for debugging
 */
router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    
    // Check if user is admin
    if (!flintUser.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    console.log('[SnapTrade Users] Admin listing all users');
    
    // Get all SnapTrade users with their Flint user info
    const snapUsers = await db
      .select({
        id: snaptradeUsers.id,
        flintUserId: snaptradeUsers.flintUserId,
        snaptradeUserId: snaptradeUsers.snaptradeUserId,
        connectedAt: snaptradeUsers.connectedAt,
        lastSyncAt: snaptradeUsers.lastSyncAt,
        flintUserEmail: users.email,
        flintUserName: users.firstName
      })
      .from(snaptradeUsers)
      .leftJoin(users, eq(snaptradeUsers.flintUserId, users.id));
    
    res.json({
      success: true,
      users: snapUsers.map(user => ({
        id: user.id,
        flintUserId: user.flintUserId,
        snaptradeUserId: user.snaptradeUserId,
        flintUserEmail: user.flintUserEmail,
        flintUserName: user.flintUserName,
        connectedAt: user.connectedAt,
        lastSyncAt: user.lastSyncAt
      }))
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Users] List users error:', error?.message || error);
    res.status(500).json({
      success: false,
      message: 'Failed to list users'
    });
  }
});

/**
 * POST /api/snaptrade/users/:id/rotate-secret
 * Rotate user secret for a specific SnapTrade user
 */
router.post('/:id/rotate-secret', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const targetFlintUserId = req.params.id;
    
    // Only allow users to rotate their own secret, unless admin
    if (flintUser.id !== targetFlintUserId && !flintUser.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Can only rotate your own secret'
      });
    }
    
    console.log('[SnapTrade Users] Rotating secret for flintUserId:', targetFlintUserId);
    
    // Get existing credentials
    const existingCredentials = await getSnaptradeCredentials(targetFlintUserId);
    if (!existingCredentials) {
      return res.status(404).json({
        success: false,
        message: 'User not found or not registered with SnapTrade'
      });
    }
    
    // Call SnapTrade to rotate the secret
    const rotation = await authApi.rotateSecret({
      userId: existingCredentials.snaptradeUserId,
      userSecret: existingCredentials.snaptradeUserSecret
    });
    
    const newUserSecret = rotation.data.userSecret!;
    if (!newUserSecret) {
      throw new Error('SnapTrade did not return new userSecret');
    }
    
    // Update credentials in database
    await db
      .update(snaptradeUsers)
      .set({
        snaptradeUserSecret: newUserSecret,
        lastSyncAt: new Date()
      })
      .where(eq(snaptradeUsers.flintUserId, targetFlintUserId));
    
    console.log('[SnapTrade Users] Secret rotation successful:', {
      flintUserId: targetFlintUserId,
      snaptradeUserId: existingCredentials.snaptradeUserId,
      newSecretLength: newUserSecret.length
    });
    
    res.json({
      success: true,
      message: 'User secret rotated successfully'
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Users] Rotate secret error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to rotate user secret'
    });
  }
});

/**
 * DELETE /api/snaptrade/users/:id
 * Delete SnapTrade user (cleanup when Flint account is deleted)
 */
router.delete('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const targetFlintUserId = req.params.id;
    
    // Only allow users to delete their own account, unless admin
    if (flintUser.id !== targetFlintUserId && !flintUser.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Can only delete your own account'
      });
    }
    
    console.log('[SnapTrade Users] Deleting user for flintUserId:', targetFlintUserId);
    
    // Get existing credentials
    const existingCredentials = await getSnaptradeCredentials(targetFlintUserId);
    if (!existingCredentials) {
      return res.status(404).json({
        success: false,
        message: 'User not found or not registered with SnapTrade'
      });
    }
    
    // Call SnapTrade to delete the user
    await authApi.deleteUser({
      userId: existingCredentials.snaptradeUserId,
      userSecret: existingCredentials.snaptradeUserSecret
    });
    
    // Remove credentials from database
    await db
      .delete(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, targetFlintUserId));
    
    console.log('[SnapTrade Users] User deletion successful:', {
      flintUserId: targetFlintUserId,
      snaptradeUserId: existingCredentials.snaptradeUserId
    });
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Users] Delete user error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to delete user'
    });
  }
});

export { router as snaptradeUsersRouter };
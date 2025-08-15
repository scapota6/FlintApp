/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides groundwork for future multi-role support
 */

import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Define role hierarchy
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  PRO_USER = 'pro_user',
  BASIC_USER = 'basic_user',
  FREE_USER = 'free_user'
}

// Define permissions
export enum Permission {
  // User management
  MANAGE_USERS = 'manage_users',
  VIEW_ALL_USERS = 'view_all_users',
  
  // Account management
  CONNECT_UNLIMITED_ACCOUNTS = 'connect_unlimited_accounts',
  CONNECT_MULTIPLE_ACCOUNTS = 'connect_multiple_accounts',
  CONNECT_SINGLE_ACCOUNT = 'connect_single_account',
  
  // Trading permissions
  EXECUTE_TRADES = 'execute_trades',
  VIEW_TRADES = 'view_trades',
  ADVANCED_TRADING = 'advanced_trading',
  
  // Data access
  EXPORT_DATA = 'export_data',
  API_ACCESS = 'api_access',
  REAL_TIME_DATA = 'real_time_data',
  
  // Analytics
  ADVANCED_ANALYTICS = 'advanced_analytics',
  BASIC_ANALYTICS = 'basic_analytics',
  
  // Admin functions
  VIEW_SYSTEM_METRICS = 'view_system_metrics',
  MANAGE_SYSTEM_SETTINGS = 'manage_system_settings'
}

// Role-Permission mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // All permissions
    ...Object.values(Permission)
  ],
  
  [UserRole.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.CONNECT_UNLIMITED_ACCOUNTS,
    Permission.EXECUTE_TRADES,
    Permission.VIEW_TRADES,
    Permission.ADVANCED_TRADING,
    Permission.EXPORT_DATA,
    Permission.API_ACCESS,
    Permission.REAL_TIME_DATA,
    Permission.ADVANCED_ANALYTICS,
    Permission.VIEW_SYSTEM_METRICS
  ],
  
  [UserRole.PRO_USER]: [
    Permission.CONNECT_UNLIMITED_ACCOUNTS,
    Permission.EXECUTE_TRADES,
    Permission.VIEW_TRADES,
    Permission.ADVANCED_TRADING,
    Permission.EXPORT_DATA,
    Permission.API_ACCESS,
    Permission.REAL_TIME_DATA,
    Permission.ADVANCED_ANALYTICS
  ],
  
  [UserRole.BASIC_USER]: [
    Permission.CONNECT_MULTIPLE_ACCOUNTS,
    Permission.EXECUTE_TRADES,
    Permission.VIEW_TRADES,
    Permission.EXPORT_DATA,
    Permission.REAL_TIME_DATA,
    Permission.BASIC_ANALYTICS
  ],
  
  [UserRole.FREE_USER]: [
    Permission.CONNECT_SINGLE_ACCOUNT,
    Permission.VIEW_TRADES,
    Permission.BASIC_ANALYTICS
  ]
};

// Map subscription tiers to roles
function subscriptionTierToRole(tier: string | null): UserRole {
  switch (tier) {
    case 'premium':
      return UserRole.PRO_USER;
    case 'pro':
      return UserRole.PRO_USER;
    case 'basic':
      return UserRole.BASIC_USER;
    case 'free':
    default:
      return UserRole.FREE_USER;
  }
}

// Check if a role has a specific permission
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) || false;
}

// Get all permissions for a role
export function getRolePermissions(role: UserRole): Permission[] {
  return rolePermissions[role] || [];
}

// Middleware to check permissions
export function requirePermission(permission: Permission) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const userId = req.user.claims.sub;
      
      // Get user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check for admin override
      if (user.email === process.env.ADMIN_EMAIL) {
        req.userRole = UserRole.SUPER_ADMIN;
        req.permissions = getRolePermissions(UserRole.SUPER_ADMIN);
        return next();
      }

      // Determine role based on subscription tier
      const role = subscriptionTierToRole(user.subscriptionTier);
      
      // Check if role has required permission
      if (!roleHasPermission(role, permission)) {
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permission,
          userRole: role
        });
      }

      // Attach role and permissions to request
      req.userRole = role;
      req.permissions = getRolePermissions(role);
      
      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ message: 'Authorization check failed' });
    }
  };
}

// Middleware to check multiple permissions (user must have at least one)
export function requireAnyPermission(...permissions: Permission[]) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const userId = req.user.claims.sub;
      
      // Get user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check for admin override
      if (user.email === process.env.ADMIN_EMAIL) {
        req.userRole = UserRole.SUPER_ADMIN;
        req.permissions = getRolePermissions(UserRole.SUPER_ADMIN);
        return next();
      }

      // Determine role based on subscription tier
      const role = subscriptionTierToRole(user.subscriptionTier);
      const userPermissions = getRolePermissions(role);
      
      // Check if user has at least one required permission
      const hasPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permissions,
          userRole: role
        });
      }

      // Attach role and permissions to request
      req.userRole = role;
      req.permissions = userPermissions;
      
      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ message: 'Authorization check failed' });
    }
  };
}

// Helper function to check permissions in route handlers
export async function checkUserPermission(
  userId: string, 
  permission: Permission
): Promise<boolean> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) return false;

    // Admin override
    if (user.email === process.env.ADMIN_EMAIL) return true;

    const role = subscriptionTierToRole(user.subscriptionTier);
    return roleHasPermission(role, permission);
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

// Export types for use in route handlers
export interface AuthenticatedRequest extends Request {
  user?: any;
  userRole?: UserRole;
  permissions?: Permission[];
}
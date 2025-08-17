import { Router } from "express";
import { authApi, accountsApi } from "../lib/snaptrade";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { users, connectedAccounts, snaptradeUsers } from "@shared/schema";
import { eq } from "drizzle-orm";

export const router = Router();

// Helper function to get user by email
async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user;
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

// Saturday night working version - Simple registration endpoint
router.post("/register", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: "User email required",
        details: "Authenticated user email is missing",
      });
    }

    console.log('SnapTrade Register: Starting for email:', email);
    
    let user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Use email as userId for SnapTrade (Saturday night working version)
    const snaptradeUserId = email;
    
    try {
      console.log('SnapTrade Register: Calling registerSnapTradeUser...');
      
      const { data } = await snaptrade.authentication.registerSnapTradeUser({
        userId: snaptradeUserId
      });
      
      console.log('SnapTrade Register: Registration successful:', {
        userId: data.userId,
        hasUserSecret: !!data.userSecret
      });
      
      // Save credentials to the database
      await saveSnaptradeCredentials(user.id, data.userId!, data.userSecret!);
      
      // Get login portal URL
      const loginPayload = {
        userId: data.userId!,
        userSecret: data.userSecret!,
      };
      
      const { data: portal } = await snaptrade.authentication.loginSnapTradeUser(loginPayload);
      
      console.log('SnapTrade Register: Portal response received:', {
        hasRedirectURI: !!(portal as any).redirectURI
      });
      
      return res.json({ url: (portal as any).redirectURI });
      
    } catch (err: any) {
      console.error('SnapTrade Registration Error:', err);
      
      // Handle USER_EXISTS error gracefully (user already registered) 
      const errData = err.response?.data || err.responseBody;
      if (errData?.code === "USER_EXISTS" || errData?.code === "1010") {
        console.log('SnapTrade Register: User already exists, returning success');
        
        // Return a success response - the connection flow can proceed
        return res.json({ 
          url: `https://connect.snaptrade.com/portal?clientId=${clientId}&userId=${encodeURIComponent(snaptradeUserId)}`,
          message: "User already registered" 
        });
      } else {
        // Other registration errors
        const status = err.response?.status || 500;
        const body = err.response?.data || { message: err.message };
        return res.status(status).json(body);
      }
    }
    
  } catch (error: any) {
    console.error('SnapTrade Register Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return res.status(500).json({
      error: "Failed to register SnapTrade user",
      message: error.message
    });
  }
});

// Test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "SnapTrade routes are working" });
});

export default router;
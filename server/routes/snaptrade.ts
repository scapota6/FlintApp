// routes/snaptrade.ts

import { Router } from "express";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// --- DB helper functions ---
async function getUserByEmail(email: string) {
  // Get user from database - we need to query by email
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0];
}

async function saveSnaptradeCredentials(
  email: string,
  snaptradeUserId: string,
  userSecret: string,
) {
  const user = await getUserByEmail(email);
  if (user) {
    // Use the correct storage method
    await storage.createSnapTradeUser(user.id, snaptradeUserId, userSecret);
  }
}

// --- Initialize SnapTrade SDK ---
let snapTradeClient: Snaptrade;
if (process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY) {
  snapTradeClient = new Snaptrade({
    clientId: process.env.SNAPTRADE_CLIENT_ID!,
    consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
  });
  console.log("✅ SnapTrade SDK initialized");
} else {
  console.warn(
    "⚠️ Missing SNAPTRADE_CLIENT_ID or SNAPTRADE_CONSUMER_KEY in environment",
  );
}

const router = Router();

router.post("/register", isAuthenticated, async (req: any, res, next) => {
  try {
    if (!snapTradeClient) {
      return res.status(502).json({
        error: "SnapTrade not configured",
        details: "Missing SNAPTRADE_CLIENT_ID or SNAPTRADE_CONSUMER_KEY in environment",
      });
    }

    const email = req.user.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({
        error: "User email required",
        details: "Authenticated user email is missing",
      });
    }

    // 1) Check DB for existing credentials
    let user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2) Register if missing credentials
    if (!user.snaptradeUserId || !user.snaptradeUserSecret) {
      try {
        console.log("Register payload:", { userId: email });
        const { data } = await snapTradeClient.authentication.registerSnapTradeUser({
          userId: email,
        });
        
        // Save credentials to DB
        await saveSnaptradeCredentials(email, data.userId!, data.userSecret!);
        user = await getUserByEmail(email);
      } catch (err: any) {
        console.error("SnapTrade registration error:", err);
        const errData = err.response?.data;
        
        // Handle "user already exists" errors
        if (
          errData?.code === "USER_EXISTS" ||
          errData?.code === "1010" ||
          /already exist/i.test(errData?.detail || errData?.message || "")
        ) {
          console.log("User already exists in SnapTrade, fetching existing user...");
          user = await getUserByEmail(email);
          
          // If we still don't have credentials, this is an issue
          if (!user?.snaptradeUserId || !user?.snaptradeUserSecret) {
            return res.status(409).json({
              error: "User already registered",
              details: "User exists in SnapTrade but credentials not found in database"
            });
          }
        } else {
          return res.status(500).json({
            error: "Failed to register SnapTrade user",
            details: errData || err.message,
          });
        }
      }
    }

    // 3) Generate connection URL using stored credentials
    console.log("🔑 Generating connection URL for user:", user.snaptradeUserId);
    const { data } = await snapTradeClient.authentication.loginSnapTradeUser({
      userId: user.snaptradeUserId!,
      userSecret: user.snaptradeUserSecret!,
    });

    // 4) Return the connection URL - access the response data properly
    console.log("🔍 SnapTrade login response:", data);
    
    // The response should contain redirectURI or similar property
    const connectionUrl = (data as any).redirectURI || (data as any).redirect_uri || (data as any).url;
    
    if (!connectionUrl) {
      console.error("No connection URL found in response:", data);
      return res.status(502).json({
        error: "No connection URL returned",
        details: "SnapTrade login response missing URL property"
      });
    }
    
    return res.json({ url: connectionUrl });
    
  } catch (err: any) {
    // Forward SnapTrade's actual status and JSON body
    const status = err.response?.status || 500;
    const body   = err.response?.data   || { message: err.message };
    return res.status(status).json(body);
  }
});



// --- (Optional) Fuzzy Search Endpoint ---
router.get("/search", isAuthenticated, async (req: any, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string" || q.length < 1) {
      return res.json([]);
    }

    const stockDatabase = [
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        price: 173.5,
        changePercent: 1.2,
        volume: 89000000,
      },
      {
        symbol: "GOOGL",
        name: "Alphabet Inc.",
        price: 2435.2,
        changePercent: -0.8,
        volume: 2100000,
      },
      {
        symbol: "MSFT",
        name: "Microsoft Corporation",
        price: 378.85,
        changePercent: 0.5,
        volume: 45000000,
      },
      {
        symbol: "TSLA",
        name: "Tesla Inc.",
        price: 248.42,
        changePercent: 2.1,
        volume: 125000000,
      },
      {
        symbol: "AMZN",
        name: "Amazon.com Inc.",
        price: 3284.7,
        changePercent: 0.9,
        volume: 12000000,
      },
      {
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        price: 448.3,
        changePercent: 2.8,
        volume: 78000000,
      },
      {
        symbol: "META",
        name: "Meta Platforms Inc.",
        price: 325.6,
        changePercent: -0.3,
        volume: 23000000,
      },
      {
        symbol: "NFLX",
        name: "Netflix Inc.",
        price: 492.8,
        changePercent: 1.1,
        volume: 18000000,
      },
    ];

    const query = q.toLowerCase().trim();
    const results = stockDatabase
      .map((stock) => {
        let score = 0;
        const sym = stock.symbol.toLowerCase();
        const nm = stock.name.toLowerCase();

        if (sym === query) score += 1000;
        else if (sym.startsWith(query)) score += 800;
        else if (sym.includes(query)) score += 600;
        else if (nm.startsWith(query)) score += 700;
        else if (nm.includes(query)) score += 300;

        return { ...stock, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
      .slice(0, 8)
      .map(({ score, ...rest }) => rest);

    res.json(results);
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

export default router;

// routes/snaptrade.ts

import { Router } from "express";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";

// --- DB helper shims (adjust import paths as needed) ---
async function getUserByEmail(email: string) {
  return await storage.getUserByEmail(email);
}

async function saveSnaptradeCredentials(
  email: string,
  userId: string,
  userSecret: string,
) {
  const user = await storage.getUserByEmail(email);
  if (user) {
    // Store plaintext secret directly
    await storage.updateSnapTradeUser(user.id, userId, userSecret);
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

router.post("/register", async (req, res, next) => {
  const email = (req.user as any).email.toLowerCase();
  let user = await getUserByEmail(email);

  // 1) Register if needed
  if (!user.snaptradeUserId || !user.snaptradeUserSecret) {
    try {
      const { data } = await snapTradeClient.authentication.registerSnapTradeUser({
        userId: email,
      });
      await saveSnaptradeCredentials(email, data.userId, data.userSecret);
      user = await getUserByEmail(email);
    } catch (err: any) {
      const errData = err.response?.data;
      if (
        errData?.code === "USER_EXISTS" ||
        errData?.code === "1010" ||
        /already exist/i.test(errData?.detail || errData?.message || "")
      ) {
        user = await getUserByEmail(email);
      } else {
        return next(err);
      }
    }
  }

  // 2) Generate the connection URL
  try {
    const { data } = await snapTradeClient.authentication.loginSnapTradeUser({
      userId: user.snaptradeUserId!,
      userSecret: user.snaptradeUserSecret!,
    });
    return res.json({ url: data.redirectURI });
  } catch (err: any) {
    console.error("SnapTrade connect-url error:", err.response?.data || err);
    return res.status(502).json({
      error: "SnapTrade URL generation failed",
      details: err.response?.data || err.message,
    });
  }
});

// --- GET /api/snaptrade/connect-url ---
router.get("/connect-url", isAuthenticated, async (req: any, res) => {
  try {
    if (!snapTradeClient) {
      return res.status(502).json({
        error: "SnapTrade not configured",
        details:
          "Missing SNAPTRADE_CLIENT_ID or SNAPTRADE_CONSUMER_KEY in environment",
      });
    }

    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({
        error: "User email required",
        details: "Authenticated user email is missing",
      });
    }

    // 1) Ensure user is registered (will no-op if already done)
    await router.handle({ method: "POST", url: "/register", ...req });

    // 2) Load stored credentials
    const user = await getUserByEmail(email);
    const { snaptradeUserId: userId, snaptradeUserSecret: userSecret } = user;

    // 3) Debug-log the exact payload
    console.log("🔑 SnapTrade login payload:", { userId, userSecret });

    // 4) Generate the connection URL
    const { data } = await snapTradeClient.authentication.loginSnapTradeUser({
      userId,
      userSecret,
    });

    // 5) Return the one-time redirectURI
    return res.json({ url: data.redirectURI });
  } catch (err: any) {
    console.error(
      "❌ SnapTrade connect-url error:",
      err.response?.data || err.message,
    );
    console.error("Request config:", err.config);
    return res.status(502).json({
      error: "SnapTrade URL generation failed",
      details: err.response?.data || err.message,
    });
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

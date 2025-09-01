import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { storage } from '../storage.js';

const router = Router();

interface RecurringSubscription {
  id: string;
  merchantName: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextBillingDate: string;
  lastTransactionDate: string;
  confidence: number;
  category: string;
  accountName: string;
  transactions: Array<{
    id: string;
    date: string;
    amount: number;
    description: string;
  }>;
}

// Detect recurring subscriptions from bank/credit card transactions
router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Get all connected Teller accounts
    const connectedAccounts = await storage.getConnectedAccounts(userId);
    const tellerAccounts = connectedAccounts.filter(acc => acc.provider === 'teller');
    
    if (tellerAccounts.length === 0) {
      return res.json({ subscriptions: [] });
    }

    const allTransactions: any[] = [];
    
    // Fetch transactions from all Teller accounts (last 12 months)
    for (const account of tellerAccounts) {
      if (!account.accessToken) continue;
      
      try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const response = await fetch(
          `https://api.teller.io/accounts/${account.externalAccountId}/transactions?count=500`,
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`,
              'Accept': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          const transactions = await response.json();
          
          // Only include outgoing transactions (negative amounts) for subscription detection
          const outgoingTransactions = transactions
            .filter((t: any) => parseFloat(t.amount) < 0)
            .map((t: any) => ({
              ...t,
              accountId: account.id,
              accountName: account.accountName,
              amount: Math.abs(parseFloat(t.amount)) // Convert to positive for easier comparison
            }));
            
          allTransactions.push(...outgoingTransactions);
        }
      } catch (error) {
        console.error(`Error fetching transactions for account ${account.id}:`, error);
      }
    }

    // Detect recurring subscriptions
    const subscriptions = detectRecurringPayments(allTransactions);
    
    res.json({ 
      subscriptions,
      totalMonthlySpend: subscriptions.reduce((sum, sub) => {
        const monthlyAmount = getMonthlyAmount(sub.amount, sub.frequency);
        return sum + monthlyAmount;
      }, 0)
    });
    
  } catch (error) {
    console.error('Error detecting subscriptions:', error);
    res.status(500).json({ 
      message: 'Failed to detect subscriptions',
      subscriptions: [] 
    });
  }
});

function detectRecurringPayments(transactions: any[]): RecurringSubscription[] {
  const subscriptions: RecurringSubscription[] = [];
  
  // Group transactions by merchant/description similarity
  const merchantGroups = groupTransactionsByMerchant(transactions);
  
  for (const [merchantKey, merchantTransactions] of merchantGroups) {
    if (merchantTransactions.length < 2) continue; // Need at least 2 transactions
    
    // Sort by date
    merchantTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Check for recurring patterns
    const recurringPattern = analyzeRecurringPattern(merchantTransactions);
    
    if (recurringPattern && recurringPattern.confidence > 0.6) {
      const latestTransaction = merchantTransactions[merchantTransactions.length - 1];
      const subscription: RecurringSubscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        merchantName: getMerchantDisplayName(merchantKey),
        amount: recurringPattern.averageAmount,
        frequency: recurringPattern.frequency,
        nextBillingDate: calculateNextBillingDate(latestTransaction.date, recurringPattern.frequency),
        lastTransactionDate: latestTransaction.date,
        confidence: recurringPattern.confidence,
        category: categorizeSubscription(merchantKey),
        accountName: latestTransaction.accountName,
        transactions: merchantTransactions.slice(-6) // Last 6 transactions
      };
      
      subscriptions.push(subscription);
    }
  }
  
  // Sort by monthly spend (highest first)
  return subscriptions.sort((a, b) => {
    const aMonthly = getMonthlyAmount(a.amount, a.frequency);
    const bMonthly = getMonthlyAmount(b.amount, b.frequency);
    return bMonthly - aMonthly;
  });
}

function groupTransactionsByMerchant(transactions: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();
  
  for (const transaction of transactions) {
    const key = getMerchantKey(transaction);
    
    // Skip transactions that don't match subscription patterns (empty key)
    if (!key || key.trim() === '') {
      continue;
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(transaction);
  }
  
  return groups;
}

function getMerchantKey(transaction: any): string {
  // Try to extract clean merchant name from description
  const description = transaction.description || '';
  const merchant = transaction.merchant_name || '';
  
  // FILTER OUT non-subscription transaction types
  const exclusionPatterns = [
    /^wire transfer/i,
    /^incoming wire/i,
    /^outgoing wire/i,
    /^deposit/i,
    /^atm withdrawal/i,
    /^check #\d+/i,
    /^debit card purchase/i,
    /^mobile deposit/i,
    /gas station|exxon|shell|chevron|bp |mobil|texaco|sunoco/i,
    /grocery|walmart|target|kroger|safeway|whole foods/i,
    /restaurant|mcdonalds|burger|pizza|starbucks|coffee/i,
    /amazon\.com purchases|amazon marketplace/i, // but allow "amazon prime"
    /uber|lyft|taxi/i,
    /parking|toll/i,
    /cash advance|balance transfer/i
  ];
  
  // Check if this transaction should be excluded from subscription detection
  const fullText = `${description} ${merchant}`.toLowerCase();
  for (const pattern of exclusionPatterns) {
    if (pattern.test(fullText)) {
      return ''; // Empty key means exclude this transaction
    }
  }
  
  // Use merchant name if available, otherwise clean up description
  let cleanKey = '';
  if (merchant) {
    cleanKey = merchant.toLowerCase().trim();
  } else {
    // Clean up common transaction prefixes/suffixes
    cleanKey = description
      .toLowerCase()
      .replace(/^(payment to|autopay|recurring|monthly|subscription)/gi, '')
      .replace(/(payment|autopay|recurring)$/gi, '')
      .replace(/\d{4}$/g, '') // Remove trailing numbers
      .replace(/[*#]/g, '') // Remove special characters
      .trim();
  }
  
  // ONLY ALLOW known subscription-like patterns
  const subscriptionPatterns = [
    /netflix|hulu|disney|spotify|apple music|youtube premium/i,
    /adobe|microsoft 365|office|google workspace/i,
    /amazon prime|prime membership/i,
    /phone|verizon|at&t|t-mobile|sprint/i,
    /internet|comcast|xfinity|spectrum|cox|optimum/i,
    /electric|gas utility|water|sewer|waste management/i,
    /insurance|progressive|geico|state farm|allstate/i,
    /gym|fitness|planet fitness|la fitness/i,
    /subscription|monthly|recurring|auto-pay/i,
    /rent|mortgage|loan payment/i
  ];
  
  // Only return the key if it matches known subscription patterns
  for (const pattern of subscriptionPatterns) {
    if (pattern.test(fullText)) {
      return cleanKey || description.toLowerCase();
    }
  }
  
  return ''; // Exclude if doesn't match subscription patterns
}

function getMerchantDisplayName(merchantKey: string): string {
  // Convert back to display format
  return merchantKey
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function analyzeRecurringPattern(transactions: any[]): { frequency: any; averageAmount: number; confidence: number } | null {
  if (transactions.length < 2) return null;
  
  // Calculate intervals between transactions (in days)
  const intervals: number[] = [];
  for (let i = 1; i < transactions.length; i++) {
    const prev = new Date(transactions[i - 1].date);
    const curr = new Date(transactions[i].date);
    const daysDiff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(daysDiff);
  }
  
  // Check for monthly pattern (28-32 days)
  const monthlyIntervals = intervals.filter(interval => interval >= 28 && interval <= 32);
  if (monthlyIntervals.length >= Math.max(1, intervals.length * 0.6)) {
    return {
      frequency: 'monthly',
      averageAmount: calculateAverageAmount(transactions),
      confidence: Math.min(0.9, monthlyIntervals.length / intervals.length)
    };
  }
  
  // Check for weekly pattern (6-8 days)
  const weeklyIntervals = intervals.filter(interval => interval >= 6 && interval <= 8);
  if (weeklyIntervals.length >= Math.max(1, intervals.length * 0.6)) {
    return {
      frequency: 'weekly',
      averageAmount: calculateAverageAmount(transactions),
      confidence: Math.min(0.9, weeklyIntervals.length / intervals.length)
    };
  }
  
  // Check for quarterly pattern (88-95 days)
  const quarterlyIntervals = intervals.filter(interval => interval >= 88 && interval <= 95);
  if (quarterlyIntervals.length >= Math.max(1, intervals.length * 0.5)) {
    return {
      frequency: 'quarterly',
      averageAmount: calculateAverageAmount(transactions),
      confidence: Math.min(0.8, quarterlyIntervals.length / intervals.length)
    };
  }
  
  // Check for yearly pattern (360-370 days)
  const yearlyIntervals = intervals.filter(interval => interval >= 360 && interval <= 370);
  if (yearlyIntervals.length >= 1) {
    return {
      frequency: 'yearly',
      averageAmount: calculateAverageAmount(transactions),
      confidence: 0.7
    };
  }
  
  return null;
}

function calculateAverageAmount(transactions: any[]): number {
  const amounts = transactions.map(t => t.amount);
  return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
}

function calculateNextBillingDate(lastDate: string, frequency: string): string {
  const date = new Date(lastDate);
  
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.toISOString().split('T')[0];
}

function categorizeSubscription(merchantKey: string): string {
  const streaming = ['netflix', 'spotify', 'hulu', 'disney', 'amazon prime', 'apple music', 'youtube', 'hbo'];
  const utilities = ['electric', 'gas', 'water', 'internet', 'phone', 'cable', 'verizon', 'att', 'comcast'];
  const software = ['adobe', 'microsoft', 'google', 'dropbox', 'github', 'slack', 'zoom'];
  const fitness = ['gym', 'fitness', 'peloton', 'planet fitness', 'yoga'];
  const finance = ['bank', 'credit', 'loan', 'insurance', 'investment'];
  
  const key = merchantKey.toLowerCase();
  
  if (streaming.some(term => key.includes(term))) return 'Streaming';
  if (utilities.some(term => key.includes(term))) return 'Utilities';
  if (software.some(term => key.includes(term))) return 'Software';
  if (fitness.some(term => key.includes(term))) return 'Fitness';
  if (finance.some(term => key.includes(term))) return 'Financial';
  
  return 'Other';
}

function getMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly': return amount * 4.33; // Average weeks per month
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / 12;
    default: return amount;
  }
}

export default router;
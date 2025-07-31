import express from 'express';
import { isAuthenticated } from '../replitAuth';
import Stripe from 'stripe';

const router = express.Router();

// Initialize Stripe if key is available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  });
}

// Process ACH/Wire deposit
router.post('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.claims.email;
    const {
      accountId,
      accountName,
      amount,
      method,
      description,
      fee,
      totalAmount
    } = req.body;

    console.log(`Processing ${method} deposit for user ${userEmail}:`, {
      accountId,
      accountName,
      amount,
      method,
      fee,
      totalAmount
    });

    // Validate deposit request
    if (!accountId || !amount || !method) {
      return res.status(400).json({
        success: false,
        message: 'Missing required deposit parameters'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Deposit amount must be greater than zero'
      });
    }

    if (amount > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum deposit amount is $50,000'
      });
    }

    // In a real implementation, you would:
    // 1. Validate account ownership
    // 2. Process the deposit via banking APIs (ACH, Wire)
    // 3. Update account balance in the database
    // 4. Create transaction records

    // For demo purposes, simulate deposit processing
    const depositId = `dep_${Date.now()}`;
    const processingTime = method === 'ach' ? '1-3 business days' : 'Same business day';
    
    const depositData = {
      id: depositId,
      userId,
      accountId,
      accountName,
      amount: parseFloat(amount),
      method,
      description: description || 'Account deposit',
      fee: fee || 0,
      totalAmount: totalAmount || amount,
      status: method === 'wire' ? 'processing' : 'pending',
      initiatedAt: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + (method === 'ach' ? 3 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
      processingTime
    };

    console.log(`✅ ${method.toUpperCase()} deposit ${depositId} initiated successfully`);

    // TODO: Store deposit in database
    // await storage.createDeposit(depositData);

    res.json({
      success: true,
      message: `${method.toUpperCase()} deposit initiated successfully`,
      deposit: depositData
    });

  } catch (error: any) {
    console.error('❌ Error processing deposit:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process deposit'
    });
  }
});

// Process Stripe deposit
router.post('/stripe', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.claims.email;
    const {
      accountId,
      accountName,
      amount,
      description,
      fee,
      totalAmount
    } = req.body;

    console.log(`Processing Stripe deposit for user ${userEmail}:`, {
      accountId,
      accountName,
      amount,
      totalAmount
    });

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Stripe integration not configured'
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Deposit to ${accountName}`,
              description: description || 'Account deposit via debit/credit card'
            },
            unit_amount: Math.round(totalAmount * 100) // Convert to cents
          },
          quantity: 1
        }
      ],
      metadata: {
        userId,
        accountId,
        accountName,
        depositAmount: amount.toString(),
        processingFee: fee.toString(),
        type: 'deposit'
      },
      success_url: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/dashboard?deposit=success`,
      cancel_url: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/dashboard?deposit=cancelled`
    });

    console.log(`✅ Stripe checkout session created: ${session.id}`);

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error: any) {
    console.error('❌ Error creating Stripe session:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment session'
    });
  }
});

// Get deposit history for user
router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.claims.email;
    
    console.log(`Fetching deposit history for user: ${userEmail}`);

    // Mock deposit history
    const mockDeposits = [
      {
        id: 'dep_1753922000',
        accountName: 'Chase Checking',
        amount: 5000.00,
        method: 'ach',
        status: 'completed',
        fee: 0,
        initiatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Monthly deposit'
      },
      {
        id: 'dep_1753921000',
        accountName: 'Robinhood Investment',
        amount: 1500.00,
        method: 'stripe',
        status: 'completed',
        fee: 46.80,
        initiatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Quick funding via card'
      }
    ];

    res.json({
      success: true,
      deposits: mockDeposits
    });

  } catch (error: any) {
    console.error('❌ Error fetching deposit history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch deposit history'
    });
  }
});

export default router;
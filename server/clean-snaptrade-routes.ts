// Clean SnapTrade routes implementation

// Step 1: Register SnapTrade user (official SnapTrade workflow)  
app.post('/api/snaptrade/register-user', isAuthenticated, async (req: any, res) => {
  try {
    const flintUserId = req.user.claims.sub;
    console.log('SnapTrade: Registering user for Flint user:', flintUserId);
    
    if (!process.env.SNAPTRADE_CLIENT_ID || !process.env.SNAPTRADE_CONSUMER_KEY) {
      return res.status(500).json({ 
        success: false, 
        message: 'SnapTrade not configured. Missing API credentials.' 
      });
    }
    
    // Check if user already exists - one SnapTrade user per Flint user
    const existingUser = await storage.getSnapTradeUser(flintUserId);
    if (existingUser) {
      console.log('SnapTrade user already exists for Flint user:', flintUserId);
      return res.json({
        success: true,
        message: 'SnapTrade user already exists',
        userId: existingUser.snaptradeUserId
      });
    }
    
    // Create unique userId as recommended by SnapTrade (immutable, not email)
    const snapTradeUserId = `flint_user_${flintUserId}_${Date.now()}`;
    
    console.log('Creating SnapTrade user with ID:', snapTradeUserId);
    
    // Clean environment variables to remove any Unicode characters
    const clientId = process.env.SNAPTRADE_CLIENT_ID.trim();
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY
      .replace(/[\u2028\u2029]/g, '')
      .replace(/[^\x00-\xFF]/g, '')
      .trim();

    // Use direct API call with proper authentication headers per SnapTrade docs
    const registerResponse = await fetch('https://api.snaptrade.com/api/v1/snapTrade/registerUser', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'clientId': clientId,
        'consumerKey': consumerKey
      },
      body: JSON.stringify({
        userId: snapTradeUserId
      })
    });

    const responseText = await registerResponse.text();
    console.log('SnapTrade register response:', responseText);

    if (!registerResponse.ok) {
      throw new Error(`Registration failed: ${registerResponse.status} - ${responseText}`);
    }

    const registerData = JSON.parse(responseText);
    
    if (registerData?.userId && registerData?.userSecret) {
      // Store the user credentials
      await storage.createSnapTradeUser(flintUserId, registerData.userId, registerData.userSecret);
      
      console.log('Successfully registered SnapTrade user:', registerData.userId);
      
      res.json({
        success: true,
        message: 'SnapTrade user registered successfully',
        userId: registerData.userId
      });
    } else {
      throw new Error('Registration failed - invalid response format');
    }

  } catch (error: any) {
    console.error('SnapTrade user registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register SnapTrade user',
      error: error.message
    });
  }
});

// Step 2: Generate SnapTrade connection URL
app.get('/api/snaptrade/connect-url', isAuthenticated, async (req: any, res) => {
  try {
    const flintUserId = req.user.claims.sub;
    
    // Validate environment variables
    if (!process.env.SNAPTRADE_CLIENT_ID || !process.env.SNAPTRADE_CONSUMER_KEY) {
      console.error('Missing SnapTrade environment variables');
      return res.status(500).json({ 
        message: "SnapTrade not configured. Missing SNAPTRADE_CLIENT_ID or SNAPTRADE_CONSUMER_KEY environment variables." 
      });
    }
    
    console.log('SnapTrade Client ID:', process.env.SNAPTRADE_CLIENT_ID);
    console.log('SnapTrade Consumer Key present:', !!process.env.SNAPTRADE_CONSUMER_KEY);
    
    // Check if user is registered with SnapTrade
    const snapTradeUser = await storage.getSnapTradeUser(flintUserId);
    
    if (!snapTradeUser) {
      console.log('SnapTrade user not found for Flint user:', flintUserId);
      return res.status(400).json({
        message: "SnapTrade user not registered. Please register first.",
        requiresRegistration: true
      });
    }
    
    console.log('Found SnapTrade user:', snapTradeUser.snaptradeUserId);
    
    // Clean environment variables
    const clientId = process.env.SNAPTRADE_CLIENT_ID.trim();
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY
      .replace(/[\u2028\u2029]/g, '')
      .replace(/[^\x00-\xFF]/g, '')
      .trim();
    
    // Set up redirect URI
    const redirectURI = `https://${req.get('host')}/dashboard?connected=true`;
    
    console.log('Generating connection URL for user:', snapTradeUser.snaptradeUserId);
    console.log('Using redirect URI:', redirectURI);
    
    // Use SnapTrade login endpoint to generate connection portal URL
    const queryParams = new URLSearchParams({
      userId: snapTradeUser.snaptradeUserId,
      userSecret: snapTradeUser.userSecret
    });

    const loginResponse = await fetch(`https://api.snaptrade.com/api/v1/snapTrade/login?${queryParams}`, {
      method: 'POST',
      headers: {
        'clientId': clientId,
        'consumerKey': consumerKey,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        broker: null,
        immediateRedirect: false,
        customRedirect: redirectURI,
        connectionType: 'read'
      })
    });

    const responseText = await loginResponse.text();
    console.log('SnapTrade login response status:', loginResponse.status);
    console.log('SnapTrade login response:', responseText);

    if (!loginResponse.ok) {
      console.error('SnapTrade login failed:', loginResponse.status, responseText);
      throw new Error(`Failed to generate connection URL: ${loginResponse.status} - ${responseText}`);
    }

    const loginData = JSON.parse(responseText);
    
    if (loginData.redirectURI) {
      console.log('Successfully generated SnapTrade connection URL');
      res.json({ url: loginData.redirectURI });
    } else {
      console.error('No redirectURI in SnapTrade response:', loginData);
      throw new Error('Invalid response from SnapTrade - no redirectURI provided');
    }
    
  } catch (error: any) {
    console.error("Error generating SnapTrade connection URL:", error);
    res.status(500).json({ 
      message: "Failed to generate connection URL: " + error.message,
      details: error.stack
    });
  }
});
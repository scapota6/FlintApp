# SnapTrade Support Request

## Issue Summary
- **Client ID**: FLINT-AGFQD
- **Problem**: 401 "Unable to verify signature sent" errors during user registration
- **API Status**: Working (version 151, online: true)
- **SDK**: snaptrade-typescript-sdk@9.0.118
- **Environment**: Development on Replit, production domain: flint-investing.com

## Error Details
```
SnaptradeError: Request failed with status code 401
URL: https://api.snaptrade.com/api/v1/snapTrade/registerUser?clientId=FLINT-AGFQD&timestamp=1752974842
Response: {
  "detail": "Unable to verify signature sent",
  "status_code": 401,
  "code": "1076"
}
```

## Current Setup
- Using official SnapTrade TypeScript SDK v9.0.118
- Environment variables: SNAPTRADE_CLIENT_ID and SNAPTRADE_CLIENT_SECRET properly configured
- API status endpoint works correctly (version 151, online: true)  
- Signature generation follows exact SDK implementation from GitHub documentation
- Request format matches official SDK examples exactly

## Code Implementation
```typescript
// SDK Initialization (matches official docs)
const snapTradeClient = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID,
  consumerKey: process.env.SNAPTRADE_CLIENT_SECRET,
});

// User Registration (matches official docs)  
const registerResponse = await snapTradeClient.authentication.registerSnapTradeUser({
  userId: snapTradeUserId
});
```

## Diagnostic Information
- Client ID: FLINT-AGFQD (visible in request URLs)
- Consumer Key: Starts with "eJunnhdd52" (from logs)
- Generated signatures appear valid (base64 encoded)
- Timestamp format: Unix seconds (1752974842)
- Request URL pattern matches expected format

## Questions for Support
1. Are there domain restrictions on API keys that could cause signature verification failures?
2. Is there additional configuration needed for development environments vs production?
3. Should we expect the SDK to work from any server environment with valid credentials?
4. Are there any known issues with the TypeScript SDK signature generation?

## Next Steps
Please advise on proper configuration or any additional setup required for successful user registration.

**Contact**: api@snaptrade.com
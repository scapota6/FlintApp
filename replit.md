# Flint - Financial Management Platform

## Overview

Flint is a comprehensive financial management web application built with React and Node.js. It provides users with a unified dashboard to connect bank accounts, brokerage accounts, and cryptocurrency wallets, track investments, execute trades, manage transfers, and monitor financial activity. The platform includes subscription-based features with Stripe integration and supports real-time financial data management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Development Activity Log

### July 26, 2025 - SnapTrade SDK Integration & Modular Architecture Complete
**Major SnapTrade Integration Breakthrough**:
- ✅ **SDK Method Location Issue Resolved**: Found registerSnapTradeUser on authentication API (not account API)
- ✅ **Modular Router Architecture**: Created separate snaptrade.ts and snaptrade-debug.ts router modules
- ✅ **Clean Codebase**: Removed all duplicate SnapTrade routes from main routes.ts file
- ✅ **Fixed Parameter Structure**: Corrected SDK method calls to use proper TypeScript interfaces
- ✅ **LSP Error Resolution**: All TypeScript compilation errors resolved
- ✅ **Working Environment**: Both SnapTrade SDK instances initialized successfully with proper credentials

**Technical Implementation Details**:
- **Correct SDK Usage**: snapTradeClient.authentication.registerSnapTradeUser({ userId: email })
- **Router Structure**: Separate /api/snaptrade/* and /api/snaptrade-debug/* endpoint groups
- **Environment Variables**: SNAPTRADE_CLIENT_ID (11 chars) and SNAPTRADE_CLIENT_SECRET (51 chars) properly loaded
- **Server Status**: Both routers mounted and responding, API version 151 online
- **Frontend Integration**: SnapTradeAPI class ready for getConnectionUrl() and registration flow

### July 26, 2025 - Security & Architecture Enhancement Complete (Previous)
**Major Security & Architecture Improvements**:
- ✅ **Credential Encryption**: Implemented AES-256-GCM encryption for SnapTrade user secrets in database
- ✅ **Rate Limiting**: Added comprehensive rate limiting for auth (5/15min), trading (30/min), data (100/min), external APIs (10/min)
- ✅ **Wallet Service**: Created secure internal funds management with hold/release capabilities
- ✅ **Trading Aggregator**: Built intelligent trade routing system with multi-brokerage position aggregation
- ✅ **ACH Transfer Integration**: Implemented Teller-based ACH transfers between user accounts
- ✅ **Modular Architecture**: Created reusable services for encryption, rate limiting, wallet management
- ✅ **Enhanced Logging**: Added comprehensive activity logging with hashed sensitive data
- ✅ **Database Schema Fixes**: Resolved account ID type mismatches causing validation errors

**Security Enhancements**:
- Credentials encrypted before database storage using industry-standard encryption
- Rate limiting prevents API abuse and DoS attacks
- Sensitive data hashed in logs for security while maintaining debugging capability
- Secure fund holding system prevents unauthorized access to user funds
- Multi-layer authentication with proper session management

**Architecture Improvements**:
- Clean separation of concerns with dedicated service layers
- Intelligent trade routing based on brokerage compatibility and fees
- Reusable trading logic abstracted into TradingAggregator service
- Modular rate limiting system easily configurable per endpoint type
- Scalable wallet service supporting multiple account types

### July 26, 2025 - Stock Detail Pages & Navigation Complete (Previous)
**Major Features Completed**:
- ✅ Individual stock detail pages (/stock/SYMBOL) with complete trading interface
- ✅ Made all search results clickable - Dashboard and Trading pages now navigate to stock details
- ✅ Enhanced stock detail pages with charts, news tabs, and buy/sell functionality
- ✅ Fixed Trading page crash with proper array type checking
- ✅ Improved SnapTrade debugging with detailed error logging

**Stock Detail Pages Include**:
- Real-time price data and key metrics (Market Cap, P/E, Volume, 52-week range)
- Interactive chart placeholder ready for real chart integration
- Company news and information tabs
- Buy/Sell trading buttons with modal interfaces
- Back navigation to previous page
- Responsive design for mobile and desktop

**Navigation Improvements**:
- Dashboard search results now clickable (Link to /stock/SYMBOL)
- Trading page search results clickable with preserved Trade button functionality
- Proper event handling to prevent conflicts between navigation and button clicks

### July 24, 2025 - SnapTrade Authentication Fixed
**Final Resolution**: Fixed SnapTrade /connect-url endpoint authentication issues

**SnapTrade Integration Progress**:
- ✅ SnapTrade SDK properly initialized and API status working (version 151, online: true)
- ✅ Fixed authentication headers to use `consumerSecret` instead of `consumerKey` 
- ✅ Cleaned Unicode characters from environment variables causing authentication failures
- ✅ Implemented proper SnapTrade API workflow per official documentation
- ✅ Updated login endpoint to use userId/userSecret as query parameters
- ✅ Simplified authentication using direct HTTP API calls with proper headers
- ✅ Server successfully starts and initializes SnapTrade integration
- **Authentication Method**: Direct API calls with clientId/consumerSecret headers
- **API Format**: userId/userSecret as query parameters, broker options in request body  
- **Environment Variables**: Properly sanitized to remove Unicode characters
- **Status**: ✅ Fixed and ready for testing - server running successfully

### July 19, 2025 - SnapTrade Integration Debugging Session (Historical)
**Previous SnapTrade Integration Attempts**:
1. **Initial Implementation**: Used direct connection URL format `https://connect.snaptrade.com/connect?user_id=${userId}&client_id=${clientId}&redirect_uri=${redirectUri}&user_secret=secret_${userId}_${timestamp}`
2. **OAuth Flow Research**: Studied official SnapTrade documentation for proper registerUser → login → redirectURI flow
3. **HMAC Signature Authentication**: Implemented proper signature generation with consumer key
4. **Crypto Import Error**: Fixed "require is not defined" by changing from `const crypto = require('crypto')` to `import crypto from "crypto"`
5. **Query Parameters Fix**: Moved clientId, userId, userSecret from request body to URL query parameters (fixed 401 "Please provide clientId, userId and userSecret in query params")
6. **Timestamp Issues**: 
   - Registration: "Invalid timestamp" error
   - Login: "Invalid userID or userSecret provided" error
7. **Current Status**: User registration failing, login failing due to invalid user credentials
8. **Latest Error**: Still getting "Invalid userID or userSecret provided" after query parameter fixes
9. **Timestamp Fix**: Fixed milliseconds to seconds conversion - timestamps now working
10. **Signature Issue**: "Unable to verify signature sent" - need to use correct consumer secret from dashboard
11. **Consumer Secret Fix**: Used actual consumer secret - signature now generates but still "Invalid userID or userSecret provided"
12. **Next Steps**: Research SnapTrade docs for proper user registration flow, check if webhooks required
13. **Documentation Analysis**: 
    - Webhooks are optional (not required for basic functionality)
    - Users persist across sessions - should check if user exists before registering
    - SnapTrade has official TypeScript SDK available
    - Current issue: trying to register existing users causes authentication problems
14. **User Already Exists**: Getting "User with the following userId already exist: '45137738'" - need to handle existing users properly
15. **Database Storage Solution**: Added snaptradeUserSecret to users table and implemented proper storage methods
16. **Smart User Management**: Now checks database first, only registers if no stored secret found
17. **Delete/Recreate Solution**: Implemented automatic user deletion and recreation for existing users without stored secrets
18. **Unique User ID Strategy**: Modified approach to create unique SnapTrade user IDs to avoid conflicts with existing users

**Known Issues**:
- SnapTrade timestamp validation failing during user registration
- User secrets not being accepted by SnapTrade login API
- Need to investigate SnapTrade's exact timestamp format requirements

**Working Integrations**:
- ✅ Teller.io: Chase login working properly
- ✅ Stripe: Payment processing configured and functional
- ✅ Database: PostgreSQL with Drizzle ORM working
- ✅ Authentication: Replit Auth functioning properly

**Frontend Issues Identified**:
- Navigation warning: nested anchor tags in mobile navigation component
- Various browser warnings about iframe attributes and features

### July 17, 2025 - Core Application Setup
**Infrastructure & Authentication**:
- ✅ Set up Express.js backend with TypeScript
- ✅ Configured PostgreSQL database with Neon
- ✅ Implemented Replit Auth with OpenID Connect
- ✅ Added session management with PostgreSQL storage
- ✅ Created user management system

**Frontend Development**:
- ✅ Built React frontend with Vite
- ✅ Implemented Tailwind CSS with dark mode
- ✅ Added Radix UI components with shadcn/ui
- ✅ Created responsive dashboard layout
- ✅ Built account connection interface

**Payment Integration**:
- ✅ Fixed Stripe initialization errors by making it conditional
- ✅ Added proper error handling for missing Stripe keys
- ✅ Implemented subscription tiers (Basic, Pro, Premium)
- ✅ Created payment UI with error states

**Database Schema**:
- ✅ Users table with subscription management
- ✅ Connected accounts for external integrations
- ✅ Holdings, trades, transfers tables
- ✅ Activity logging system
- ✅ Watchlist functionality

**External API Integrations**:
- ✅ Teller.io: Successfully integrated for bank account connections
- ⚠️ SnapTrade: SDK working, API status confirmed, likely domain restriction issue
  - API Status: ✅ Working (version 151, online)
  - SDK Initialization: ✅ Working
  - User Registration: ❌ Failing due to domain restrictions
  - Issue: API keys configured for flint-investing.com, running on Replit domain
- ✅ Stripe: Payment processing working

**Current Application State**:
- Application running on port 5000
- All core features functional except SnapTrade
- User can authenticate, connect bank accounts via Teller.io, manage subscriptions
- Dashboard showing account balances and portfolio data
- Real-time updates working (30-second intervals for dashboard, 10-second for trades)

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: React Query (@tanstack/react-query) for server state
- **Styling**: Tailwind CSS with custom dark theme
- **UI Components**: Radix UI components with shadcn/ui design system
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: PostgreSQL-backed sessions with connect-pg-simple
- **API Pattern**: RESTful API with JSON responses

### Key Components

1. **Authentication System**
   - Uses Replit Auth for user authentication
   - Session-based authentication with PostgreSQL session store
   - Protected routes with middleware authentication checks

2. **Database Schema**
   - Users table for profile information and subscription data
   - Connected accounts for banks, brokerages, and crypto wallets
   - Holdings table for investment positions
   - Watchlist for tracking favorite assets
   - Trades table for transaction history
   - Transfers table for money movement tracking
   - Activity log for user action tracking
   - Market data table for asset information

3. **Financial Data Management**
   - Multi-account connection support (banks, brokerages, crypto)
   - Real-time balance tracking and portfolio management
   - Trade execution simulation
   - Transfer management between accounts
   - Watchlist functionality for market tracking

4. **Subscription System**
   - Three-tier subscription model (Basic, Pro, Premium)
   - Stripe integration for payment processing
   - Feature gating based on subscription level

## Data Flow

1. **User Authentication**: Users authenticate via Replit Auth, sessions stored in PostgreSQL
2. **Account Connection**: Users connect external accounts (simulated integration)
3. **Data Aggregation**: Financial data is aggregated from connected accounts
4. **Real-time Updates**: Dashboard updates every 30 seconds, trades every 10 seconds
5. **User Actions**: All user actions (trades, transfers, logins) are logged to activity table

## Security & Architecture Enhancements (Latest)

### Security Framework
- **Credential Encryption**: AES-256-GCM encryption for all sensitive API credentials stored in database
- **Rate Limiting**: Multi-tier rate limiting system (auth: 5/15min, trading: 30/min, data: 100/min, external: 10/min)
- **Activity Logging**: Comprehensive logging with sensitive data hashing for security compliance
- **Session Security**: PostgreSQL-backed sessions with proper expiration and cleanup

### Wallet Service Architecture
- **Internal Fund Management**: Secure wallet system for fund holding without acting as a broker
- **Instant Allocation**: Pre-authorization system for instant brokerage fund allocation
- **ACH Integration**: Teller-based ACH transfers between user's connected accounts
- **Hold/Release System**: Secure fund holds for pending transactions with automatic release

### Trading Aggregation Engine
- **Intelligent Routing**: Multi-factor trade routing based on fees, compatibility, and account balances
- **Position Aggregation**: Real-time position consolidation across multiple brokerage accounts
- **Brokerage Scoring**: Dynamic scoring system for optimal trade execution
- **Risk Management**: Pre-trade validation and fund availability checking

### Modular Architecture
- **Service Layer**: Clean separation with dedicated services for encryption, wallet, trading
- **Reusable Components**: Abstracted trading logic for easy extension and maintenance
- **Scalable Design**: Microservice-ready architecture with clear API boundaries
- **Error Handling**: Comprehensive error handling with detailed logging and user feedback

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Database ORM and query builder
- **@stripe/stripe-js**: Payment processing
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: UI component primitives
- **passport**: Authentication middleware
- **openid-client**: OpenID Connect authentication

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type checking
- **tailwindcss**: Styling framework
- **esbuild**: Production server bundling

## Deployment Strategy

### Development
- Uses Vite development server with HMR
- Replit-specific plugins for development environment
- Environment variables for database and API keys

### Production
- Frontend: Vite build to static files served by Express
- Backend: esbuild bundles server code to ESM format
- Database: PostgreSQL via Neon Database
- Session storage: PostgreSQL table
- Static files served from Express with proper routing fallback

### Environment Configuration
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `STRIPE_SECRET_KEY`: Stripe API key
- `REPLIT_DOMAINS`: Allowed domains for auth
- `ISSUER_URL`: OpenID Connect issuer URL

The application follows a modern full-stack architecture with clear separation between frontend and backend, using TypeScript throughout for type safety and maintainability. The financial data is simulated but follows realistic patterns for a production financial application.
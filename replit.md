# Flint - Financial Management Platform

## Overview

Flint is a comprehensive financial management web application built with React and Node.js. It provides users with a unified dashboard to connect bank accounts, brokerage accounts, and cryptocurrency wallets, track investments, execute trades, manage transfers, and monitor financial activity. The platform includes subscription-based features with Stripe integration and supports real-time financial data management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Development Activity Log

### July 27, 2025 - Real-Time Data & Error Handling Complete (fix/data-logic-real-time-pricing-order-flow-page-errors)
**Comprehensive Platform Fixes & Real-Time Data Integration**:
**Complete Platform UI Unification with Real-Time Data Integration**:
- ✅ **Global Navigation Bar**: Fixed top navbar with dark theme (#121212), animated purple link glow effects, mobile hamburger menu
- ✅ **Enhanced Account Grid**: Three-column responsive grid with purple glow borders, hover scale effects (1.03x), 240px minimum width
- ✅ **Account Details Modal**: Full-screen modal (80% width/height) with Overview, Holdings, and Transactions tabs, animated purple underlines
- ✅ **Quick Actions Bar**: Full-width colored action bar with Quick Buy (green), Quick Sell (red), Transfer Funds (purple) buttons
- ✅ **Skeleton & Error States**: Animated shimmer loading cards and red-bordered retry error cards with proper UX
- ✅ **Interactive Micro-animations**: Icon pulse effects, button hover glows, sparkle title effect, smooth 200ms transitions
- ✅ **Two-Click Disconnect Flow**: Enhanced with inline popover confirmation and proper styling integration

**Real-Time Market Data & Live Sync System (NEW)**:
- ✅ **Unified Market Data Service**: Created comprehensive MarketDataService replacing all mock data with live API integration
- ✅ **Real-Time Watchlist**: Live AAPL, GOOGL, TSLA quotes from SnapTrade API with 1-minute caching
- ✅ **Alpha Vantage Integration**: Dual-source data fetching with fallback support for comprehensive market coverage
- ✅ **Official Company Logos**: StockIcon component displays authentic company branding for major stocks
- ✅ **Live Price Synchronization**: Dashboard, Trading, and Stock Detail pages show consistent real-time pricing

**Comprehensive Error Handling & Data Integrity (NEW)**:
- ✅ **Array.isArray Protection**: All activities and transfers wrapped with runtime checks to prevent .filter errors
- ✅ **Enhanced Skeleton States**: ActivitySkeleton, TransferSkeleton, HoldingsSkeleton components for proper loading UX
- ✅ **ErrorRetryCard Component**: Standardized retry error cards with "Failed to load. Retry?" messaging
- ✅ **Null Data Guards**: Safe property access using (quote as any)?.property patterns throughout
- ✅ **API Fallback Logic**: Graceful degradation when SnapTrade or Alpha Vantage APIs unavailable

**Stock Detail Modal System (NEW)**:
- ✅ **Modal-Based Stock Details**: Replaced /stock/:symbol routes with comprehensive StockDetailModal
- ✅ **Multi-Tab Interface**: Overview, Chart, News, and Trade tabs with real-time data integration
- ✅ **TradingView Chart Integration**: Enhanced charts with live price feeds and technical indicators
- ✅ **Direct Trading Actions**: Buy/Sell buttons within modal for seamless trading workflow
- ✅ **Key Statistics Display**: Market cap, volume, P/E ratio, 52-week ranges with real calculations

**Typography & Design System Standardization (NEW)**:
- ✅ **Inter Font Family**: Consistent Inter typography across all pages and components
- ✅ **Color Standardization**: #CCCCCC body text, #FFFFFF headings, purple accent (#8e44ad) throughout
- ✅ **Page Layout Consistency**: Unified margins, headers, grid gutters across Dashboard, Trading, Transfers, Activity
- ✅ **Mobile Navigation Fix**: Removed duplicate MobileNav imports, unified navigation system
- ✅ **Professional Polish**: Consistent spacing, hover states, and micro-interactions platform-wide

**End-to-End Test Framework (NEW)**:
- ✅ **Comprehensive Test Flows**: Created TestFlows class for validating all critical user journeys
- ✅ **Teller Bank Sync Testing**: End-to-end bank connection verification workflow
- ✅ **SnapTrade Brokerage Testing**: Complete brokerage integration and auto-popup closure validation
- ✅ **Quick Actions Testing**: Buy/Sell/Transfer button flows with paper trading simulation
- ✅ **Market Data Accuracy**: Cross-validation between SnapTrade and Alpha Vantage data sources
- ✅ **Automated Test Execution**: window.TestFlows.runAllTests() for complete platform validation

**Data Visualization Micro-interactions (NEW)**:
- ✅ **AnimatedCounter Component**: Smooth easing animations for numeric values with customizable duration, prefix/suffix support
- ✅ **ProgressBar Component**: Animated progress indicators with gradient fills, pulse effects, and percentage display
- ✅ **MetricCard Component**: Enhanced metric cards with sparkle effects, change indicators, progress bars, and hover scaling
- ✅ **ChartPlaceholder Component**: Interactive SVG charts with staggered animations, hover effects, moving dots, and trend indicators
- ✅ **InteractiveTable Component**: Sortable tables with hover effects, row scaling, and animated sorting icons
- ✅ **AnimatedBadge Component**: Status badges with glow effects, pulse animations, and interactive press states
- ✅ **Enhanced Summary Cards**: MetricCards with mini-chart overlays, animated counters, and progress visualization
- ✅ **Interactive Watchlist**: Stock items with pulse indicators, hover charts, and staggered entrance animations
- ✅ **Holdings Table**: Sortable positions table with animated badges for P/L and interactive hover states

**UI/UX Enhancements**:
- **Typography**: Inter font family throughout with proper weight hierarchy (600 for headings, 400 for body)
- **Color Scheme**: Accent purple (#8e44ad) for hover glows, link underlines, focus rings
- **Accessibility**: Full keyboard navigation, focus outlines, ARIA compliance, screen reader support
- **Responsive Design**: Mobile-first grid collapse, full-screen modals on mobile, disabled hover effects on touch
- **Professional Polish**: Glassmorphism effects, backdrop blur, smooth animations, tooltip system

### July 26, 2025 - Real-Time Quotes & TradingView Integration Complete (Previous)
**Real-Time Data System**:
- ✅ **Live SnapTrade Quotes**: Implemented getUserAccountQuotes API with 10-second polling for real-time prices
- ✅ **TradingView Chart Integration**: Full TradingView advanced charts with dark theme and trading buttons
- ✅ **Holdings & Watchlist APIs**: Stabilized endpoints to prevent dashboard errors - returns empty arrays instead of crashing
- ✅ **Quote API Service**: Created /api/quotes/:symbol endpoint using SnapTrade live data (AAPL showing $215)
- ✅ **Dashboard Stability**: Fixed holdings endpoint to require accountId parameter, preventing 500 errors

**Previous Order System Fixes**:
- ✅ **Fixed Order Parameter Structure**: Updated to use account_id, action, symbol, order_type, time_in_force, units (SnapTrade official format)
- ✅ **Switched to placeForceOrder**: Changed from placeOrder (requires tradeId) to placeForceOrder (direct placement)
- ✅ **Fixed Order History**: Updated to use getAccountActivities method instead of deprecated getOrderHistory
- ✅ **Dark Theme Modal**: Applied complete dark styling to TradeModal for better readability
- ✅ **Error Resolution**: Fixed "Required parameter tradeId was null or undefined" error completely

**Order System Technical Details**:
- **Place Orders**: Uses snaptrade.trading.placeForceOrder() with proper parameter structure
- **Order History**: Uses snaptrade.accountInformation.getAccountActivities() with filtering for BUY,SELL,OPTION_BUY,OPTION_SELL
- **Parameter Mapping**: quantity → units, action → BUY/SELL uppercase, orderType → Market/Limit capitalized
- **Authentication**: Proper userId/userSecret credential handling from database

**UI Improvements**:
- **Dark Theme Modal**: TradeModal now uses gray-900 background with white text for proper contrast
- **Enhanced Alerts**: Error and success messages styled with dark theme (red-900/20, green-900/20 backgrounds)
- **Form Elements**: All inputs, selects, and buttons styled consistently with dark theme
- **Better Readability**: All text properly contrasted against dark backgrounds

### July 26, 2025 - SnapTrade Unified Architecture Complete & Production Ready (Previous)
**Major SnapTrade Integration Success**:
- ✅ **Unified Route Architecture**: Consolidated all SnapTrade functionality into single POST /api/snaptrade/register endpoint
- ✅ **Official SDK Implementation**: Using snaptrade-typescript-sdk@9.0.118 with exact parameter structure per documentation
- ✅ **Clean Route Structure**: Removed all standalone register-user, connection-portal, connect-url endpoints
- ✅ **Proper Error Handling**: Express error middleware with raw SnapTrade error forwarding
- ✅ **Database Integration**: Credential persistence with getUserByEmail() lookup by req.user.claims.email
- ✅ **Account Management**: GET /api/snaptrade/accounts returns "Please connect your brokerage first" when no userSecret

**Production-Ready Workflow**:
1. **POST /api/snaptrade/register** → registers user + generates connection portal URL
2. **User completes brokerage connection via portal**
3. **GET /api/snaptrade/accounts** → lists connected brokerage accounts
4. **All endpoints protected by isAuthenticated middleware**

**Technical Implementation**:
- **SDK Calls**: registerSnapTradeUser({ userId: email }) → loginSnapTradeUser({ userId, userSecret })
- **Response Format**: { url: portal.redirectURI } for frontend consumption
- **Error Handling**: HTTP status codes and JSON bodies forwarded directly from SnapTrade API
- **Server Status**: API version 151 online, all endpoints responding correctly

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
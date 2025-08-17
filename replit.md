# Flint - Financial Management Platform

## Overview
Flint is a comprehensive financial management web application built with React and Node.js. It provides users with a unified dashboard to connect bank accounts, brokerage accounts, and cryptocurrency wallets, track investments, execute trades, manage transfers, and monitor financial activity. The platform includes subscription-based features with Stripe integration and supports real-time financial data management. The business vision is to provide a seamless and unified financial management experience, addressing the market need for an intuitive platform that consolidates diverse financial data and enables active management. The project ambitions include becoming a leading personal finance tool with robust features for both novice and experienced investors.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (August 2025)
- **SnapTrade Integration Complete**: Implemented comprehensive auto-provision system following SnapTrade documentation precisely. Single app credentials with correct redirect URI format eliminates signature verification errors (1076). File-based userSecret storage (`data/snaptrade-users.json`) ensures one SnapTrade user per Flint user. Clean Connect route follows proper flow: register → save userSecret → login for portal URL. All "snaptradeClient is not defined" crashes eliminated through centralized configuration.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: React Query (@tanstack/react-query) for server state
- **Styling**: Tailwind CSS with custom dark theme, leveraging Radix UI components via shadcn/ui for a consistent design system.
- **Build Tool**: Vite for development and production builds.
- **UI/UX Decisions**: Fixed top navigation bar with dark theme and animated link glow effects, enhanced three-column responsive account grid with purple glow borders and hover effects, full-screen modals with animated purple underlines, and full-width quick action bars. Interactive micro-animations like icon pulse effects, button hover glows, and smooth transitions are used throughout. Typography is standardized with the Inter font family, and a consistent color scheme uses purple as the accent color. Accessibility features include keyboard navigation, focus outlines, and ARIA compliance.
- **Key Features**: Comprehensive banking integration with live balances and transaction history, full buy/sell workflow implementation with real-time price display, multi-tab stock detail modal with integrated TradingView charts, unified real-time market data system, Accounts Directory with sortable/paginated tables, Portfolio Dashboard with net worth tracking and asset allocation visualization, TradingView Lightweight Charts integration with multiple timeframes (1D/1W/1M/3M/6M/1Y/5Y), IndexedDB caching for market data, complete trading MVP with order placement/cancellation through SnapTrade, and Watchlist & Alerts system with price monitoring and notifications.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM, utilizing Neon Database for serverless deployment.
- **Authentication**: Replit Auth with OpenID Connect and PostgreSQL-backed session management, enhanced with httpOnly/SameSite cookies, CSRF protection, and session revocation on logout.
- **API Pattern**: RESTful API with JSON responses.

### Key Components
- **Authentication System**: Utilizes Replit Auth for user authentication with session-based, PostgreSQL-stored sessions and protected routes.
- **Database Schema**: Includes tables for Users (profile, subscription), Connected Accounts (banks, brokerages, crypto), Holdings, Watchlist, Trades, Transfers, Activity Log, Market Data, Price Alerts, Alert History, and Notification Preferences.
- **Alert Monitoring System**: Background service that checks price alerts every minute, with debouncing (5-minute cooldown), quiet hours support, and email/push notification capabilities.
- **Financial Data Management**: Supports multi-account connections, real-time balance tracking, portfolio management, trade execution simulation, transfer management, and watchlist functionality.
- **Subscription System**: Implements a three-tier model (Basic, Pro, Premium) with Stripe integration for payment processing and feature gating.
- **Security Framework**: AES-256-GCM encryption for sensitive credentials, multi-tier rate limiting with brute-force protection (auth, trading, data, external APIs), comprehensive activity logging with sensitive data hashing, secure PostgreSQL-backed sessions with httpOnly/SameSite cookies, CSRF protection on state-changing routes, proper session revocation on logout, RBAC middleware with role-based permissions, encrypted token storage at rest, automatic secret rotation capabilities, and SOC 2 compliant infrastructure.
- **Wallet Service Architecture**: Provides internal fund management with pre-authorization and hold/release capabilities, integrated ACH transfers via Teller.
- **Trading Aggregation Engine**: Intelligent trade routing based on multiple factors, real-time position consolidation across brokerages, and pre-trade validation for risk management.
- **Modular Architecture**: Clean separation of concerns with dedicated service layers for encryption, wallet management, and trading aggregation, ensuring a scalable and maintainable design.
- **Compliance Framework**: Comprehensive legal disclaimers system clearly stating Flint is not a financial advisor, custodian, or broker-dealer. Interactive disclaimer components with user acknowledgment tracking, role-based access control (RBAC) groundwork for future multi-role support, and security dashboard for monitoring encryption status and audit logs.
- **Settings Management**: Complete settings page with profile management, notification preferences (email/push with quiet hours), connected accounts management with revoke functionality, data export to CSV (holdings and transactions), and account deletion with full data removal.

## External Dependencies

### Core Integrations
- **Teller.io**: For bank account connections and ACH transfers.
- **SnapTrade**: For brokerage account connections, real-time quotes, and trading functionalities (buy/sell orders, account activities, positions). Complete auto-provision system implemented with file-based userSecret storage. Architecture follows SnapTrade docs precisely: single app credentials, correct redirect URI format, one SnapTrade user per Flint user with auto-provisioning on signup/first interaction. Key files: server/lib/snaptrade.ts (SDK initialization), server/store/snapUsers.ts (file-based storage), server/services/snaptradeProvision.ts (auto-provision service), server/routes/connections.snaptrade.ts (Connect button endpoint), server/routes/holdings.ts (authenticated holdings with stored userSecret pairs).
- **Stripe**: For subscription management and payment processing.
- **Finnhub**: Used for general financial data.
- **Polygon.io**: For real-time market data and live pricing.
- **Alpha Vantage**: Fallback for real-time market data.

### Technical Libraries/Frameworks
- **@neondatabase/serverless**: PostgreSQL database connectivity.
- **drizzle-orm**: Database ORM.
- **@stripe/stripe-js**: Stripe API integration.
- **@tanstack/react-query**: Server state management.
- **@radix-ui/react-***: UI component primitives.
- **passport**: Authentication middleware.
- **openid-client**: OpenID Connect authentication.
- **vite**: Frontend build tool.
- **typescript**: Language.
- **tailwindcss**: CSS framework.
- **esbuild**: Backend bundling.
- **date-fns**: Date formatting.
# Flint - Financial Management Platform

## Overview
Flint is a comprehensive financial management web application that provides users with a unified dashboard to connect bank accounts, brokerage accounts, and cryptocurrency wallets, track investments, execute trades, manage transfers, and monitor financial activity. The platform aims to offer a seamless and unified financial management experience by consolidating diverse financial data and enabling active management, with ambitions to become a leading personal finance tool for both novice and experienced investors.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: React Query (@tanstack/react-query)
- **Styling**: Tailwind CSS with custom dark theme, leveraging Radix UI components via shadcn/ui.
- **Build Tool**: Vite
- **UI/UX Decisions**: Fixed top navigation, animated link glows, three-column responsive account grid with glow borders and hover effects, full-screen modals with animated underlines, full-width quick action bars, interactive micro-animations (icon pulse, button hover glows, smooth transitions). Uses Inter font family and a consistent purple accent color. Includes accessibility features like keyboard navigation, focus outlines, and ARIA compliance.
- **Key Features**: Comprehensive banking integration (balances, transactions), full buy/sell workflow with real-time pricing, multi-tab stock detail modal with TradingView charts, unified real-time market data system, Accounts Directory, Portfolio Dashboard (net worth, asset allocation), TradingView Lightweight Charts (multiple timeframes), IndexedDB caching for market data, complete trading MVP (order placement/cancellation via SnapTrade), Watchlist & Alerts with price monitoring and notifications, enhanced instrument resolution with cross-SDK compatibility.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM, utilizing Neon Database.
- **Authentication**: Replit Auth with OpenID Connect and PostgreSQL-backed session management, enhanced with httpOnly/SameSite cookies, CSRF protection, and session revocation.
- **API Pattern**: RESTful API with JSON responses.

### Key Components
- **Authentication System**: Replit Auth for user authentication with session-based, PostgreSQL-stored sessions and protected routes.
- **Database Schema**: Tables for Users, Connected Accounts, Holdings, Watchlist, Trades, Transfers, Activity Log, Market Data, Price Alerts, Alert History, and Notification Preferences.
- **Alert Monitoring System**: Background service for price alerts with debouncing, quiet hours, and email/push notifications.
- **Financial Data Management**: Multi-account connections, real-time balance tracking, portfolio management, trade execution simulation, transfer management, and watchlist.
- **Subscription System**: Three-tier model (Basic, Pro, Premium) with Stripe integration for payment processing and feature gating.
- **Security Framework**: AES-256-GCM encryption for sensitive credentials, multi-tier rate limiting, activity logging with sensitive data hashing, secure PostgreSQL-backed sessions, CSRF protection, session revocation on logout, RBAC middleware, encrypted token storage, automatic secret rotation, SOC 2 compliant infrastructure.
- **Wallet Service Architecture**: Internal fund management with pre-authorization and hold/release, integrated ACH transfers via Teller.
- **Trading Aggregation Engine**: Complete trading system with intelligent routing, real-time position consolidation, pre-trade validation, enhanced instrument resolution with cross-SDK compatibility, robust trade preview/placement APIs with version-safe wrappers, tradeId-based order placement with fallbacks, comprehensive error handling with detailed debugging, and flexible validation flow supporting both preview-then-place and direct placement workflows.
- **Modular Architecture**: Clean separation of concerns with dedicated service layers for encryption, wallet management, and trading aggregation.
- **Compliance Framework**: Legal disclaimers system (not a financial advisor, custodian, or broker-dealer) with user acknowledgment tracking, RBAC groundwork, and security dashboard.
- **Settings Management**: Profile management, notification preferences, connected accounts management, data export (CSV), and account deletion.

## External Dependencies

### Core Integrations
- **Teller.io**: Bank account connections and ACH transfers.
- **SnapTrade**: Brokerage account connections, real-time quotes, and trading functionalities (buy/sell orders, account activities, positions).
- **Stripe**: Subscription management and payment processing.
- **Finnhub**: General financial data.
- **Polygon.io**: Real-time market data and live pricing.
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
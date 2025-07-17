# Flint - Financial Management Platform

## Overview

Flint is a comprehensive financial management web application built with React and Node.js. It provides users with a unified dashboard to connect bank accounts, brokerage accounts, and cryptocurrency wallets, track investments, execute trades, manage transfers, and monitor financial activity. The platform includes subscription-based features with Stripe integration and supports real-time financial data management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### July 17, 2025
- **Fixed Stripe Integration Issues**: Resolved startup errors by making Stripe initialization conditional on API key presence
- **Updated Error Handling**: Added proper error responses for Stripe subscription routes when Stripe is not configured
- **Application Startup**: Successfully debugged and fixed application startup failures
- **Stripe Configuration**: Added Stripe secret key to environment variables - payment processing now fully enabled
- **Frontend Stripe Error Fix**: Resolved "empty string" error in frontend by adding conditional Stripe loading and proper error handling
- **Payment UI Enhancement**: Added proper error messages when Stripe publishable key is not available
- **Status**: Application is running successfully on port 5000 with all backend features enabled

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
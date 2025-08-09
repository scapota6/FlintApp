# PHP Trading Application

A comprehensive trading platform converted from Node.js/React to PHP with real API integrations, authentication, and comprehensive testing.

## 🚀 Features

### ✅ Complete Implementation
- **Database Migrations**: Full PostgreSQL schema with users, accounts, holdings, trades, and market data
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Real API Integration**: SnapTrade for trading, Alpha Vantage for market data
- **Comprehensive Testing**: PHPUnit tests for all major components
- **Modern PHP**: PHP 8.4 with strict typing and modern practices
- **Performance Optimized**: Caching, compression, and database optimization

### 🔐 Authentication System
- User registration and login
- JWT token generation and validation
- Password hashing with Argon2ID
- Session management
- Activity logging
- Demo user creation

### 📊 Trading Features
- Real-time stock quotes
- Portfolio management
- Trade execution through SnapTrade API
- Holdings tracking
- Watchlist management
- Market data caching
- Symbol search

### 🗄️ Database Schema
- **Users**: User accounts with subscription tiers
- **Connected Accounts**: Bank/brokerage integrations
- **Holdings**: Portfolio positions
- **Trades**: Transaction history
- **Watchlist**: User stock watchlists
- **Activity Log**: User action tracking
- **Market Data**: Cached quote data

## 🛠️ Installation

### Prerequisites
- PHP 8.4+
- Composer
- PostgreSQL (or SQLite for development)
- Redis (optional, for caching)

### Setup
```bash
# Install dependencies
composer install

# Copy environment configuration
cp .env.example .env

# Edit .env with your database and API credentials
# Required:
# - DB_* settings
# - JWT_SECRET
# - SNAPTRADE_CLIENT_ID/SECRET (for trading)
# - ALPHA_VANTAGE_API_KEY (for market data)

# Run database migrations
php app/Database/migrate.php

# Start development server
composer start
```

## 🔧 Configuration

### Environment Variables
```env
# Database
DB_CONNECTION=pgsql
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=trading_app
DB_USERNAME=postgres
DB_PASSWORD=your_password

# JWT Authentication
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION=3600

# SnapTrade API (for real trading)
SNAPTRADE_CLIENT_ID=your-client-id
SNAPTRADE_CLIENT_SECRET=your-client-secret
SNAPTRADE_BASE_URL=https://api.snaptrade.com/api/v1

# Alpha Vantage API (for market data)
ALPHA_VANTAGE_API_KEY=your-api-key

# Optional: Stripe for payments
STRIPE_SECRET_KEY=your-stripe-key
STRIPE_PUBLISHABLE_KEY=your-publishable-key
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/demo` - Create demo user
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/logout` - Logout (protected)

### Trading (Protected Routes)
- `GET /api/dashboard` - Dashboard data
- `GET /api/holdings` - User portfolio
- `GET /api/positions` - SnapTrade positions
- `GET /api/trades` - Trade history
- `POST /api/trades` - Place new trade

### Market Data (Public)
- `GET /api/quotes/{symbol}` - Get stock quote
- `GET /api/search?q={query}` - Search symbols

### Demo Endpoints
- `GET /api/demo/dashboard` - Demo dashboard data
- `GET /api/demo/quotes/{symbol}` - Demo quotes

## 🧪 Testing

### Run Tests
```bash
# Run all tests
composer test

# Run specific test suite
vendor/bin/phpunit tests/Unit
vendor/bin/phpunit tests/Integration

# Run with coverage
vendor/bin/phpunit --coverage-html coverage
```

### Test Coverage
- **AuthService**: User authentication, registration, JWT tokens
- **QuoteService**: Market data fetching, caching, API fallbacks
- **Controllers**: HTTP request/response handling
- **Middleware**: Authentication validation

## 🏗️ Architecture

### Directory Structure
```
php-trading-app/
├── app/
│   ├── Http/
│   │   ├── Controllers/     # Request handlers
│   │   └── Middleware/      # Request middleware
│   ├── Services/           # Business logic
│   ├── Models/             # Database models
│   └── Database/           # Migrations
├── tests/
│   ├── Unit/              # Unit tests
│   └── Integration/       # Integration tests
├── public/                # Web server root
├── resources/views/       # Twig templates
└── vendor/               # Composer dependencies
```

### Design Patterns
- **Dependency Injection**: Constructor injection throughout
- **Repository Pattern**: Database abstraction in models
- **Service Layer**: Business logic separation
- **Middleware Pattern**: Request/response processing
- **Factory Pattern**: Object creation and configuration

## 🔄 API Integration

### SnapTrade API
- User creation and management
- Brokerage account connections
- Real trading execution
- Portfolio data retrieval
- Order management

### Alpha Vantage API
- Real-time stock quotes
- Intraday chart data
- Symbol search
- Market status
- Automatic caching and fallbacks

## 🚦 Error Handling

### Comprehensive Error Management
- API request failures with fallbacks
- Database connection errors
- Authentication token validation
- Input validation and sanitization
- Detailed logging for debugging

### Fallback Strategies
- Mock data when APIs are unavailable
- Cached data for offline scenarios
- Graceful degradation of features
- User-friendly error messages

## 📈 Performance

### Optimization Features
- **Database Indexing**: Optimized queries with proper indexes
- **Query Caching**: Market data caching with TTL
- **API Rate Limiting**: Intelligent request throttling
- **Response Compression**: Gzip compression middleware
- **Connection Pooling**: Efficient database connections

### Caching Strategy
- **Market Data**: 5-minute cache during market hours, 1-hour otherwise
- **User Data**: 2-minute cache for personal information
- **Static Data**: Long-term caching for reference data

## 🔐 Security

### Security Measures
- **Password Hashing**: Argon2ID for secure password storage
- **JWT Tokens**: Secure token-based authentication
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Prepared statements
- **CORS Configuration**: Secure cross-origin requests
- **Rate Limiting**: API abuse prevention

## 🚀 Deployment

### Production Setup
```bash
# Install production dependencies
composer install --no-dev --optimize-autoloader

# Set production environment
export APP_ENV=production
export APP_DEBUG=false

# Configure web server (Apache/Nginx)
# Point document root to public/
# Enable PHP-FPM
# Configure SSL/TLS

# Set up database
# Run migrations
# Configure caching (Redis)
```

### Docker Deployment
```dockerfile
FROM php:8.4-fpm
# Install extensions and dependencies
# Copy application files
# Configure environment
```

## 📊 Monitoring

### Health Checks
- `GET /health` - Application health status
- Database connectivity
- External API availability
- System resources

### Logging
- Application logs via Monolog
- Error tracking and alerting
- Performance monitoring
- User activity tracking

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit pull request

### Code Standards
- PSR-12 coding standards
- Strict typing enabled
- Comprehensive documentation
- Test coverage requirements

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

### Getting Help
- Check the documentation
- Review test cases for examples
- Check logs for error details
- Create GitHub issues for bugs

### API Documentation
- Interactive API docs available at `/docs`
- Postman collection included
- Example requests and responses

## 🎯 Roadmap

### Planned Features
- [ ] WebSocket real-time updates
- [ ] Advanced charting
- [ ] Options trading
- [ ] Crypto trading
- [ ] Mobile API
- [ ] Advanced analytics

---

**Converted from Node.js/React to PHP** - Maintaining all original functionality while leveraging PHP's enterprise-grade stability and performance.
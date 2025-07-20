# Flint Deployment Setup

## Domain Configuration

### Development Environment
- **Current**: Running on Replit domain for development
- **SnapTrade Domain**: API keys configured for `flint-investing.com`
- **Solution**: Use production domain for SnapTrade callbacks while developing on Replit

### Production Domain Setup
- **Domain**: flint-investing.com
- **SnapTrade Integration**: API keys configured for this domain
- **SSL**: Required for SnapTrade callbacks

### Development Workflow
1. Develop on Replit (current setup)
2. SnapTrade callbacks redirect to flint-investing.com (where domain is configured)
3. Deploy to production when ready

### Required Environment Variables
- `SNAPTRADE_CLIENT_ID`: Configured for flint-investing.com
- `SNAPTRADE_CLIENT_SECRET`: Configured for flint-investing.com
- `DATABASE_URL`: PostgreSQL connection
- `STRIPE_SECRET_KEY`: Payment processing

### Deployment Notes
- SnapTrade requires HTTPS for production
- Domain must match configuration in SnapTrade dashboard
- Connection portal callbacks use production domain
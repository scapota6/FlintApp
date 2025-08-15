# Flint Deployment Guide

## Overview
This guide covers the deployment process for Flint, including staging and production environments, CI/CD pipeline, and rollback procedures.

## Environments

### Staging Environment
- **URL**: https://staging.flint.app
- **Purpose**: Testing new features before production release
- **Database**: Separate PostgreSQL instance
- **API Keys**: Test keys for all services (Stripe, SnapTrade, etc.)

### Production Environment
- **URL**: https://flint.app
- **Purpose**: Live application serving real users
- **Database**: Production PostgreSQL with automated backups
- **API Keys**: Production keys with strict rate limits

## Environment Variables

### Required Variables (Both Environments)
```bash
# Database
DATABASE_URL=postgresql://user:password@host/database

# Authentication
SESSION_SECRET=secure-random-string
ISSUER_URL=https://replit.com/oidc
REPLIT_DOMAINS=your-domains

# SnapTrade API
SNAPTRADE_CLIENT_ID=your-client-id
SNAPTRADE_CONSUMER_KEY=your-consumer-key

# Teller API
TELLER_APP_ID=your-app-id
TELLER_KEY_ID=your-key-id
TELLER_PRIVATE_KEY=your-private-key

# Stripe
STRIPE_SECRET_KEY=sk_test_or_live_key
STRIPE_WEBHOOK_SECRET=whsec_secret

# Market Data
POLYGON_API_KEY=your-polygon-key
FINNHUB_API_KEY=your-finnhub-key

# Security
ENCRYPTION_KEY=32-character-key
ENCRYPTION_SALT=16-character-salt
```

## CI/CD Pipeline

### Automated Testing
The CI/CD pipeline runs automatically on push to main/staging branches:

1. **Type Checking**: `npm run typecheck`
2. **Linting**: `npm run lint`
3. **Unit Tests**: `npm run test:unit`
4. **E2E Smoke Tests**: `npm run test:e2e:smoke`
5. **Security Scan**: npm audit and Snyk scan

### Manual Deployment Steps

#### Deploy to Staging
```bash
# 1. Set environment to staging
export DEPLOYMENT_ENV=staging

# 2. Build the application
npm run build:staging

# 3. Run database migrations
npm run db:migrate:staging

# 4. Deploy using blue/green script
./scripts/deploy-blue-green.sh staging
```

#### Deploy to Production
```bash
# 1. Ensure all tests pass
npm run test:all

# 2. Set environment to production
export DEPLOYMENT_ENV=production

# 3. Build the application
npm run build:production

# 4. Create deployment backup
./scripts/backup.sh create

# 5. Run database migrations
npm run db:migrate:production

# 6. Deploy using blue/green script
./scripts/deploy-blue-green.sh production

# 7. Run smoke tests
npm run test:e2e:smoke:prod
```

## Blue/Green Deployment

The deployment uses a blue/green strategy for zero-downtime deployments:

1. **Current State**: Identify active deployment (blue or green)
2. **Deploy to Inactive**: Deploy new version to inactive environment
3. **Health Check**: Verify new deployment is healthy
4. **Switch Traffic**: Route traffic to new deployment
5. **Monitor**: Watch metrics and logs for issues
6. **Cleanup**: Stop old deployment after confirmation

## Rollback Procedures

### Quick Rollback (< 5 minutes)
For immediate issues after deployment:
```bash
# Run quick rollback to previous version
sudo ./scripts/rollback.sh
# Select option 1 for quick rollback
```

### Selective Rollback
For rolling back to a specific backup:
```bash
# List available backups
sudo ./scripts/rollback.sh
# Select option 3 to list backups
# Select option 2 and choose backup number
```

### Manual Rollback Steps
If automated rollback fails:

1. **Stop Current Application**
   ```bash
   pm2 stop flint
   ```

2. **Restore Previous Version**
   ```bash
   cd /var/app/flint
   tar -xzf /var/backups/flint/backup-[timestamp].tar.gz
   ```

3. **Restore Database (if needed)**
   ```bash
   psql $DATABASE_URL < /var/backups/flint/db-backup-[timestamp].sql
   ```

4. **Restart Application**
   ```bash
   pm2 start server/index.js --name flint --env production
   ```

5. **Verify Health**
   ```bash
   curl https://flint.app/api/health
   ```

## Monitoring

### Health Checks
- **Endpoint**: `/api/health`
- **Frequency**: Every 30 seconds
- **Timeout**: 5 seconds
- **Alerts**: Sent to Slack/Email on failure

### Key Metrics
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database connection pool
- Background job queue size
- Active user sessions

### Log Aggregation
- Application logs: PM2 logs
- Error tracking: Sentry
- Performance monitoring: Custom metrics dashboard

## Backup Strategy

### Automated Backups
- **Frequency**: Every 6 hours
- **Retention**: 7 days for hourly, 30 days for daily
- **Storage**: Encrypted S3 bucket

### Manual Backup
```bash
# Create full backup (database + files)
./scripts/backup.sh create-full

# Create database-only backup
./scripts/backup.sh create-db

# List backups
./scripts/backup.sh list
```

## Security Considerations

### Pre-Deployment Checklist
- [ ] All secrets rotated from staging
- [ ] HTTPS/TLS certificates valid
- [ ] Rate limiting configured
- [ ] CORS settings reviewed
- [ ] CSP headers configured
- [ ] Database connections encrypted
- [ ] Audit logs enabled

### Post-Deployment Verification
- [ ] Health endpoint responding
- [ ] Authentication working
- [ ] Payment processing functional
- [ ] Market data updating
- [ ] Email notifications sending
- [ ] Error tracking connected

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database status
psql $DATABASE_URL -c "SELECT 1"

# Restart database connections
pm2 restart flint
```

#### High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart with memory limit
pm2 restart flint --max-memory-restart 1G
```

#### SSL Certificate Issues
```bash
# Check certificate expiry
openssl s_client -connect flint.app:443 -servername flint.app < /dev/null | openssl x509 -noout -dates

# Renew certificate
certbot renew --nginx
```

## Emergency Contacts

- **On-Call Engineer**: Via PagerDuty
- **Database Admin**: database-team@flint.app
- **Security Team**: security@flint.app
- **Customer Support**: support@flint.app

## Deployment Schedule

- **Staging**: Continuous deployment on merge to staging branch
- **Production**: Weekly on Tuesday 10 AM EST (low traffic period)
- **Hotfixes**: Immediate deployment with abbreviated testing

## Version History

Track all deployments in `CHANGELOG.md` with:
- Version number
- Deployment date
- Key changes
- Known issues
- Rollback instructions if special considerations
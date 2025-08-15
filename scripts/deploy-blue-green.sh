#!/bin/bash

# Blue/Green Deployment Script for Flint
# This script handles zero-downtime deployments with automatic rollback capabilities

set -e

# Configuration
DEPLOYMENT_ENV="${1:-staging}"
APP_NAME="flint"
DEPLOYMENT_DIR="/var/app/${APP_NAME}"
BLUE_PORT=3001
GREEN_PORT=3002
NGINX_CONFIG="/etc/nginx/sites-available/${APP_NAME}"
HEALTH_CHECK_URL="http://localhost:{{PORT}}/api/health"
HEALTH_CHECK_TIMEOUT=30
ROLLBACK_ON_FAILURE=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Determine current active deployment
get_active_deployment() {
    if curl -s http://localhost:${BLUE_PORT}/api/health > /dev/null 2>&1; then
        echo "blue"
    elif curl -s http://localhost:${GREEN_PORT}/api/health > /dev/null 2>&1; then
        echo "green"
    else
        echo "none"
    fi
}

# Health check function
health_check() {
    local port=$1
    local attempts=0
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / 2))
    
    log_info "Running health checks on port ${port}..."
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -f -s "http://localhost:${port}/api/health" > /dev/null 2>&1; then
            local response=$(curl -s "http://localhost:${port}/api/health")
            if echo "$response" | grep -q '"status":"healthy"'; then
                log_success "Health check passed!"
                return 0
            fi
        fi
        
        attempts=$((attempts + 1))
        log_info "Health check attempt ${attempts}/${max_attempts}..."
        sleep 2
    done
    
    log_error "Health check failed after ${HEALTH_CHECK_TIMEOUT} seconds"
    return 1
}

# Deploy to specific environment
deploy_to_environment() {
    local target_env=$1
    local target_port=$2
    local deployment_path="${DEPLOYMENT_DIR}/${target_env}"
    
    log_info "Deploying to ${target_env} environment on port ${target_port}"
    
    # Create deployment directory if it doesn't exist
    mkdir -p "${deployment_path}"
    
    # Extract deployment artifact
    log_info "Extracting deployment artifact..."
    tar -xzf deployment-*.tar.gz -C "${deployment_path}"
    
    # Copy environment-specific configuration
    log_info "Applying ${DEPLOYMENT_ENV} configuration..."
    cp "config/${DEPLOYMENT_ENV}.env" "${deployment_path}/.env"
    
    # Install production dependencies
    cd "${deployment_path}"
    log_info "Installing production dependencies..."
    npm ci --production
    
    # Run database migrations
    log_info "Running database migrations..."
    npm run db:migrate:prod
    
    # Start the application
    log_info "Starting application on port ${target_port}..."
    pm2 delete "${APP_NAME}-${target_env}" 2>/dev/null || true
    pm2 start server/index.js \
        --name "${APP_NAME}-${target_env}" \
        --env production \
        --update-env \
        -- --port ${target_port}
    
    # Wait for application to be ready
    sleep 5
    
    # Run health check
    if ! health_check ${target_port}; then
        log_error "Deployment failed health check!"
        return 1
    fi
    
    log_success "Deployment to ${target_env} completed successfully!"
    return 0
}

# Switch traffic to new deployment
switch_traffic() {
    local new_active=$1
    local new_port=$2
    
    log_info "Switching traffic to ${new_active} deployment..."
    
    # Update nginx configuration
    cat > /tmp/nginx-${APP_NAME}.conf <<EOF
upstream ${APP_NAME}_backend {
    server localhost:${new_port};
}

server {
    listen 80;
    server_name ${APP_NAME}.app;
    
    location / {
        proxy_pass http://${APP_NAME}_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    # Test nginx configuration
    if nginx -t -c /tmp/nginx-${APP_NAME}.conf; then
        mv /tmp/nginx-${APP_NAME}.conf ${NGINX_CONFIG}
        nginx -s reload
        log_success "Traffic switched to ${new_active} deployment!"
        return 0
    else
        log_error "Nginx configuration test failed!"
        return 1
    fi
}

# Rollback to previous deployment
rollback() {
    local previous_env=$1
    local previous_port=$2
    
    log_warning "Initiating rollback to ${previous_env} deployment..."
    
    if switch_traffic ${previous_env} ${previous_port}; then
        log_success "Rollback completed successfully!"
        return 0
    else
        log_error "Rollback failed! Manual intervention required!"
        return 1
    fi
}

# Main deployment flow
main() {
    log_info "Starting Blue/Green deployment for ${APP_NAME} to ${DEPLOYMENT_ENV}"
    
    # Determine current active deployment
    CURRENT_ACTIVE=$(get_active_deployment)
    log_info "Current active deployment: ${CURRENT_ACTIVE}"
    
    # Determine target deployment
    if [ "$CURRENT_ACTIVE" = "blue" ]; then
        TARGET_ENV="green"
        TARGET_PORT=$GREEN_PORT
        CURRENT_PORT=$BLUE_PORT
    else
        TARGET_ENV="blue"
        TARGET_PORT=$BLUE_PORT
        CURRENT_PORT=$GREEN_PORT
    fi
    
    log_info "Target deployment: ${TARGET_ENV} (port ${TARGET_PORT})"
    
    # Deploy to target environment
    if deploy_to_environment ${TARGET_ENV} ${TARGET_PORT}; then
        log_success "Deployment successful, switching traffic..."
        
        # Switch traffic to new deployment
        if switch_traffic ${TARGET_ENV} ${TARGET_PORT}; then
            log_success "Traffic switched successfully!"
            
            # Run smoke tests on production
            log_info "Running smoke tests..."
            if npm run test:e2e:smoke:prod; then
                log_success "Smoke tests passed!"
                
                # Stop old deployment after successful switch
                if [ "$CURRENT_ACTIVE" != "none" ]; then
                    log_info "Stopping old ${CURRENT_ACTIVE} deployment..."
                    pm2 stop "${APP_NAME}-${CURRENT_ACTIVE}"
                fi
                
                log_success "Blue/Green deployment completed successfully!"
                exit 0
            else
                log_error "Smoke tests failed!"
                if [ "$ROLLBACK_ON_FAILURE" = true ] && [ "$CURRENT_ACTIVE" != "none" ]; then
                    rollback ${CURRENT_ACTIVE} ${CURRENT_PORT}
                fi
                exit 1
            fi
        else
            log_error "Traffic switch failed!"
            if [ "$ROLLBACK_ON_FAILURE" = true ] && [ "$CURRENT_ACTIVE" != "none" ]; then
                rollback ${CURRENT_ACTIVE} ${CURRENT_PORT}
            fi
            exit 1
        fi
    else
        log_error "Deployment failed!"
        exit 1
    fi
}

# Run main function
main
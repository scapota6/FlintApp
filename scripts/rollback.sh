#!/bin/bash

# Rollback Script for Flint
# This script provides immediate rollback capabilities in case of deployment issues

set -e

# Configuration
APP_NAME="flint"
DEPLOYMENT_DIR="/var/app/${APP_NAME}"
BACKUP_DIR="/var/backups/${APP_NAME}"
MAX_BACKUPS=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# List available backups
list_backups() {
    log_info "Available backups:"
    ls -1t ${BACKUP_DIR} | head -${MAX_BACKUPS} | nl
}

# Rollback to specific backup
rollback_to_backup() {
    local backup_number=$1
    local backup_name=$(ls -1t ${BACKUP_DIR} | head -${MAX_BACKUPS} | sed -n "${backup_number}p")
    
    if [ -z "$backup_name" ]; then
        log_error "Invalid backup number: ${backup_number}"
        return 1
    fi
    
    log_info "Rolling back to: ${backup_name}"
    
    # Stop current application
    log_info "Stopping current application..."
    pm2 stop ${APP_NAME} || true
    
    # Backup current deployment
    local current_backup="${BACKUP_DIR}/rollback-$(date +%Y%m%d-%H%M%S).tar.gz"
    log_info "Creating backup of current deployment..."
    tar -czf ${current_backup} -C ${DEPLOYMENT_DIR} .
    
    # Restore backup
    log_info "Restoring backup..."
    rm -rf ${DEPLOYMENT_DIR}/*
    tar -xzf "${BACKUP_DIR}/${backup_name}" -C ${DEPLOYMENT_DIR}
    
    # Restore database if backup exists
    if [ -f "${BACKUP_DIR}/${backup_name%.tar.gz}.sql" ]; then
        log_info "Restoring database backup..."
        psql $DATABASE_URL < "${BACKUP_DIR}/${backup_name%.tar.gz}.sql"
    fi
    
    # Restart application
    log_info "Starting application..."
    cd ${DEPLOYMENT_DIR}
    pm2 start server/index.js --name ${APP_NAME} --env production
    
    # Health check
    sleep 5
    if curl -f -s "http://localhost:3000/api/health" > /dev/null 2>&1; then
        log_success "Rollback completed successfully!"
        return 0
    else
        log_error "Application failed to start after rollback!"
        return 1
    fi
}

# Quick rollback to last known good state
quick_rollback() {
    log_warning "Performing quick rollback to last known good state..."
    rollback_to_backup 1
}

# Main menu
main() {
    echo "==================================="
    echo "   Flint Rollback Tool"
    echo "==================================="
    echo ""
    echo "1) Quick rollback (to last backup)"
    echo "2) Select specific backup"
    echo "3) List available backups"
    echo "4) Exit"
    echo ""
    read -p "Select option: " option
    
    case $option in
        1)
            quick_rollback
            ;;
        2)
            list_backups
            read -p "Enter backup number to restore: " backup_num
            rollback_to_backup $backup_num
            ;;
        3)
            list_backups
            ;;
        4)
            exit 0
            ;;
        *)
            log_error "Invalid option"
            exit 1
            ;;
    esac
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root or with sudo"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Run main function
main
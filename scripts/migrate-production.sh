#!/bin/bash

# Production database migration script
# Run this script to safely deploy migrations to production

set -e

echo "🗄️  Production Database Migration Script"
echo "========================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL is not set"
  exit 1
fi

# Confirm production migration
read -p "⚠️  Are you sure you want to run migrations on PRODUCTION? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Migration cancelled"
  exit 1
fi

# Backup database before migration
echo "📦 Creating database backup..."
timestamp=$(date +%Y%m%d_%H%M%S)
backup_file="backups/db_backup_${timestamp}.sql"

# Create backups directory if it doesn't exist
mkdir -p backups

# Create backup (PostgreSQL)
pg_dump "$DATABASE_URL" > "$backup_file"
echo "✅ Backup created: $backup_file"

# Show migration status
echo "📊 Current migration status:"
npx prisma migrate status

# Deploy migrations
echo "🚀 Deploying migrations..."
npx prisma migrate deploy

# Verify migration
echo "✅ Verifying migration status..."
npx prisma migrate status

echo "✅ Migration completed successfully!"
echo "📦 Backup location: $backup_file"

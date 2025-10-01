#!/bin/bash

# Automated database backup script
# Can be run manually or scheduled via cron

set -e

echo "📦 Database Backup Script"
echo "========================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL is not set"
  exit 1
fi

# Configuration
BACKUP_DIR="backups"
RETENTION_DAYS=30
timestamp=$(date +%Y%m%d_%H%M%S)
backup_file="${BACKUP_DIR}/db_backup_${timestamp}.sql"
compressed_file="${backup_file}.gz"

# Create backups directory
mkdir -p "$BACKUP_DIR"

echo "📊 Creating database backup..."
pg_dump "$DATABASE_URL" > "$backup_file"

# Compress backup
echo "🗜️  Compressing backup..."
gzip "$backup_file"

backup_size=$(du -h "$compressed_file" | cut -f1)
echo "✅ Backup created: $compressed_file ($backup_size)"

# Clean up old backups
echo "🧹 Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Count remaining backups
backup_count=$(find "$BACKUP_DIR" -name "db_backup_*.sql.gz" | wc -l)
echo "✅ Backup complete! Total backups: $backup_count"

# Optional: Upload to S3 or cloud storage
if [ -n "$AWS_S3_BACKUP_BUCKET" ]; then
  echo "☁️  Uploading to S3..."
  aws s3 cp "$compressed_file" "s3://${AWS_S3_BACKUP_BUCKET}/database-backups/"
  echo "✅ Uploaded to S3: s3://${AWS_S3_BACKUP_BUCKET}/database-backups/$(basename $compressed_file)"
fi

# Optional: Upload to Vercel Blob
if [ -n "$BLOB_READ_WRITE_TOKEN" ]; then
  echo "☁️  Uploading to Vercel Blob..."
  curl -X PUT \
    -H "Authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
    --data-binary "@$compressed_file" \
    "https://blob.vercel-storage.com/$(basename $compressed_file)"
  echo "✅ Uploaded to Vercel Blob"
fi

echo "✅ Backup process completed successfully!"

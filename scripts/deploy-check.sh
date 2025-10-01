#!/bin/bash

# Pre-deployment checks for production deployment

set -e

echo "🔍 Running pre-deployment checks..."

# Check if required environment variables are set
check_env_var() {
  if [ -z "${!1}" ]; then
    echo "❌ Error: $1 is not set"
    exit 1
  fi
}

echo "✅ Checking environment variables..."
check_env_var "DATABASE_URL"
check_env_var "NEXTAUTH_SECRET"
check_env_var "REDIS_URL"
check_env_var "OPENAI_API_KEY"

# Check database connection
echo "✅ Checking database connection..."
npx prisma db execute --stdin <<< "SELECT 1" || {
  echo "❌ Error: Cannot connect to database"
  exit 1
}

# Check Redis connection
echo "✅ Checking Redis connection..."
if ! redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
  echo "❌ Error: Cannot connect to Redis"
  exit 1
fi

# Run database migrations check
echo "✅ Checking database migrations..."
npx prisma migrate status || {
  echo "⚠️  Warning: Pending database migrations"
}

# Build check
echo "✅ Running build check..."
npm run build || {
  echo "❌ Error: Build failed"
  exit 1
}

# Run tests
echo "✅ Running tests..."
npm run test || {
  echo "❌ Error: Tests failed"
  exit 1
}

echo "✅ All pre-deployment checks passed!"
echo "🚀 Ready for deployment"

# Setup Guide

## Prerequisites

Before running the application, you need to set up the following services:

## 1. Database Setup (Supabase)

### Option A: Using Supabase Cloud (Recommended)

1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Go to Settings > Database
4. Copy the connection string and update `DATABASE_URL` in `.env.local`
5. Go to Settings > API
6. Copy the `URL` and `anon` key to `.env.local`:
   ```
   SUPABASE_URL="https://your-project-id.supabase.co"
   SUPABASE_ANON_KEY="your-anon-key"
   ```

### Option B: Local PostgreSQL

1. Install PostgreSQL locally
2. Create a database: `createdb cc_ig_dev`
3. Update `.env.local` with your local connection string:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/cc_ig_dev"
   ```

## 2. Redis Setup

### Option A: Local Redis (Development)
```bash
# Install Redis (macOS)
brew install redis

# Start Redis
brew services start redis

# Or run manually
redis-server
```

### Option B: Cloud Redis (Production)
- Use Redis Cloud, Upstash, or similar
- Update `REDIS_URL` in `.env.local`

## 3. API Keys

### Required APIs:
1. **Apify** - For Instagram scraping
   - Sign up at [apify.com](https://apify.com)
   - Get API token from Console > Integrations

2. **OpenRouter** - For AI models
   - Sign up at [openrouter.ai](https://openrouter.ai)
   - Create API key

3. **Pinecone** - For vector search
   - Sign up at [pinecone.io](https://pinecone.io)
   - Create index named "content-vectors"

### Optional APIs:
1. **Slack** - For notifications
2. **Google OAuth** - For Google Docs integration

## 4. Database Migration

After setting up your database:

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Or create and run migrations
npx prisma migrate dev --name init
```

## 5. Run the Application

```bash
# Start development server
npm run dev

# In another terminal, start queue workers (when implemented)
npm run workers
```

## Verification

1. Visit `http://localhost:3000` - should show the home page
2. Check database connection - Prisma should connect successfully
3. Check Redis connection - queues should initialize without errors

## Troubleshooting

### Common Issues:

1. **Database connection failed**
   - Verify `DATABASE_URL` is correct
   - Check if database exists and is accessible

2. **Redis connection failed**
   - Ensure Redis is running: `redis-cli ping`
   - Check `REDIS_URL` format

3. **API rate limits**
   - Verify API keys are valid
   - Check rate limits for each service

4. **Missing dependencies**
   - Run `npm install` to ensure all packages are installed
   - Use `--legacy-peer-deps` if needed for conflicts
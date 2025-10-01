# Deployment Guide

Complete guide for deploying the AI Content Automation Workflow System to production.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Redis Setup](#redis-setup)
5. [Vercel Deployment](#vercel-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Post-Deployment](#post-deployment)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- [ ] Vercel account
- [ ] PostgreSQL database (Supabase/Neon/Railway)
- [ ] Redis instance (Upstash/Railway)
- [ ] GitHub account (for CI/CD)
- [ ] Cloudinary or AWS S3 (for CDN)
- [ ] OpenAI/OpenRouter API access
- [ ] Sentry account (for monitoring)

### Local Requirements
- Node.js 20.x or higher
- PostgreSQL 15+ (for local testing)
- Redis 7+ (for local testing)
- Git

---

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/cc-ig.git
cd cc-ig
npm install
```

### 2. Environment Variables

Create `.env.production` file with all required variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?pgbouncer=true&connection_limit=1"

# Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_KEY="your-service-key"

# Redis
REDIS_URL="rediss://default:password@host:6379"

# Authentication
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# APIs
OPENAI_API_KEY="sk-..."
OPENROUTER_API_KEY="sk-or-..."
APIFY_TOKEN="apify_api_..."

# Pinecone
PINECONE_API_KEY="..."
PINECONE_ENVIRONMENT="us-east-1-aws"
PINECONE_INDEX="content-vectors"

# CDN
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# Monitoring
NEXT_PUBLIC_SENTRY_DSN="https://...@sentry.io/..."
SENTRY_AUTH_TOKEN="..."

# Slack (Optional)
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# Queue Settings
QUEUE_CONCURRENCY="10"
MAX_RETRY_ATTEMPTS="3"
```

### 3. Generate NextAuth Secret
```bash
openssl rand -base64 32
```

---

## Database Setup

### Option 1: Supabase (Recommended)

1. **Create Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Copy connection string

2. **Enable Connection Pooling**
   - Go to Database → Settings
   - Enable Connection Pooling (PgBouncer)
   - Use pooled connection string in `DATABASE_URL`

3. **Run Migrations**
   ```bash
   npx prisma migrate deploy
   ```

### Option 2: Neon

1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Copy connection string
4. Run migrations

### Option 3: Railway

1. Create account at [railway.app](https://railway.app)
2. Create PostgreSQL service
3. Copy connection string
4. Run migrations

### Database Connection Pooling

For production, use connection pooling to handle serverless environments:

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL") // For migrations
}
```

Add to `.env.production`:
```bash
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
DIRECT_DATABASE_URL="postgresql://..." # Direct connection for migrations
```

---

## Redis Setup

### Option 1: Upstash (Recommended for Vercel)

1. **Create Database**
   - Go to [upstash.com](https://upstash.com)
   - Create Redis database
   - Select region close to your users
   - Enable TLS

2. **Configure**
   ```bash
   REDIS_URL="rediss://default:password@host:6379"
   ```

### Option 2: Railway

1. Create Redis service on Railway
2. Copy connection URL
3. Add to environment variables

### Redis Configuration for BullMQ

```typescript
// src/lib/queue/config.ts
const redisConfig = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    return Math.min(times * 50, 2000);
  },
};
```

---

## Vercel Deployment

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Link Project
```bash
vercel link
```

### 3. Configure Environment Variables

Add all environment variables in Vercel dashboard:
- Go to Project Settings → Environment Variables
- Add each variable from `.env.production`
- Select "Production" environment

### 4. Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

### 5. Configure Vercel Settings

#### vercel.json
Already configured with:
- Function timeouts (60s default, 300s for webhooks)
- Cron jobs for cleanup tasks
- Environment variable references

#### Custom Domain
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records
4. Enable automatic HTTPS

---

## CI/CD Pipeline

### GitHub Actions Setup

1. **Add Repository Secrets**

   Go to Settings → Secrets and variables → Actions:

   ```
   VERCEL_TOKEN - Get from vercel.com/account/tokens
   VERCEL_ORG_ID - From .vercel/project.json
   VERCEL_PROJECT_ID - From .vercel/project.json
   PRODUCTION_DATABASE_URL - Production database URL
   SLACK_WEBHOOK_URL - For deployment notifications
   CODECOV_TOKEN - For test coverage (optional)
   ```

2. **Pipeline Stages**
   - Lint → Test → Build → E2E Tests → Deploy
   - Automatic preview deployments for PRs
   - Production deployment on main branch push

3. **Manual Deployment**
   ```bash
   # Trigger deployment via GitHub CLI
   gh workflow run ci.yml
   ```

---

## Post-Deployment

### 1. Run Database Migrations
```bash
./scripts/migrate-production.sh
```

### 2. Verify Deployment
```bash
# Run deployment checks
./scripts/deploy-check.sh
```

### 3. Initialize Data

```bash
# Create default workspace (optional)
curl -X POST https://your-domain.vercel.app/api/admin/init \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 4. Test Critical Flows

- [ ] User authentication
- [ ] Workflow creation
- [ ] Content generation
- [ ] Queue processing
- [ ] Webhook handlers
- [ ] Image uploads

### 5. Configure Cron Jobs

Vercel Cron jobs are configured in `vercel.json`:
- Daily cleanup at 2 AM UTC
- Metrics backup every 6 hours

### 6. Setup Monitoring

#### Sentry
1. Create project at [sentry.io](https://sentry.io)
2. Add DSN to environment variables
3. Verify error tracking works

#### Vercel Analytics
1. Enable in Vercel dashboard
2. Monitor performance metrics

---

## Monitoring

### Application Monitoring

#### Sentry Dashboard
- Error rate and trends
- Performance metrics
- User feedback
- Release tracking

#### Vercel Analytics
- Page load times
- Core Web Vitals
- Geographic distribution

### Queue Monitoring

Access Bull Board dashboard:
```
https://your-domain.vercel.app/api/admin/queues
```

Monitor:
- Active jobs
- Completed jobs
- Failed jobs
- Processing rates

### Database Monitoring

#### Supabase Dashboard
- Connection count
- Query performance
- Storage usage
- API requests

### Logs

View logs in real-time:
```bash
vercel logs --follow
```

Filter by function:
```bash
vercel logs --follow | grep "api/workflows"
```

---

## Scaling Considerations

### Database Connection Pooling

Use PgBouncer for connection pooling:
```
?pgbouncer=true&connection_limit=1
```

### Redis Clustering

For high traffic, upgrade to Redis cluster:
- Upstash: Upgrade to Pro plan
- Railway: Enable Redis Cluster

### Horizontal Scaling

Vercel automatically scales:
- Edge functions globally distributed
- Auto-scaling based on traffic
- No configuration needed

### Queue Workers

For heavy queue processing, deploy dedicated workers:

1. Create separate service (Railway/Render)
2. Deploy worker-only instance
3. Point to same Redis instance
4. Configure concurrency

```typescript
// worker.ts
const worker = new Worker('queue-name', processor, {
  connection: redis,
  concurrency: 20, // Adjust based on resources
});
```

---

## Backup Strategy

### Automated Backups

#### Daily Database Backups
```bash
# Add to cron (if not using managed backups)
0 2 * * * /path/to/scripts/backup-database.sh
```

#### Backup Retention
- Daily: 7 days
- Weekly: 4 weeks
- Monthly: 12 months

### Manual Backup
```bash
./scripts/backup-database.sh
```

### Restore from Backup
```bash
# Download backup
aws s3 cp s3://bucket/backups/db_backup_20250930.sql.gz .

# Restore
gunzip db_backup_20250930.sql.gz
psql $DATABASE_URL < db_backup_20250930.sql
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors
```
Error: Can't reach database server
```

**Solution:**
- Check DATABASE_URL format
- Verify IP whitelist (0.0.0.0/0 for Vercel)
- Ensure connection pooling is enabled
- Check connection limits

#### 2. Redis Connection Timeout
```
Error: Redis connection timed out
```

**Solution:**
- Use Redis URL with TLS (rediss://)
- Check Redis instance status
- Verify maxRetriesPerRequest: null

#### 3. Function Timeout
```
Error: Function execution timed out
```

**Solution:**
- Increase timeout in vercel.json
- Optimize slow queries
- Move to background jobs

#### 4. Out of Memory
```
Error: JavaScript heap out of memory
```

**Solution:**
- Upgrade Vercel plan (Pro: 3GB RAM)
- Optimize bundle size
- Use streaming for large data

#### 5. Build Failures
```
Error: Build failed with exit code 1
```

**Solution:**
- Check environment variables
- Run `npm run build` locally
- Review build logs
- Clear Vercel cache

### Health Checks

Create health check endpoint:
```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    queues: await checkQueues(),
  };

  return Response.json(checks);
}
```

### Performance Debugging

1. Enable Sentry performance monitoring
2. Use Vercel Analytics
3. Check database query performance
4. Monitor Redis latency
5. Profile slow API routes

---

## Rollback Procedure

If deployment fails:

### 1. Instant Rollback
```bash
# Revert to previous deployment
vercel rollback
```

### 2. Database Rollback
```bash
# Restore from backup
./scripts/restore-backup.sh backup_20250930.sql.gz
```

### 3. Revert Code
```bash
git revert HEAD
git push origin main
```

---

## Security Checklist

- [ ] All environment variables secured in Vercel
- [ ] Database has SSL/TLS enabled
- [ ] Redis has TLS enabled
- [ ] NextAuth secret is strong and unique
- [ ] API routes have authentication
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Sentry error tracking active
- [ ] Backups automated and tested
- [ ] Monitoring alerts configured

---

## Support

For deployment issues:
- GitHub Issues: https://github.com/your-org/cc-ig/issues
- Documentation: /docs
- Vercel Support: https://vercel.com/support

---

## Next Steps

After successful deployment:

1. [ ] Monitor error rates in Sentry
2. [ ] Check performance in Vercel Analytics
3. [ ] Test all critical user flows
4. [ ] Setup alerting for failures
5. [ ] Document any custom configurations
6. [ ] Schedule regular backup tests
7. [ ] Plan capacity scaling

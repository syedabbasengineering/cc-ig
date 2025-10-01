# Quick Vercel Deployment Guide

## Build Error Fix Applied

The following changes have been made to resolve the npm peer dependency conflicts:

### 1. Created `.npmrc` file
Forces `legacy-peer-deps=true` for all npm operations.

### 2. Updated `package.json`
- Added `postinstall` script to generate Prisma client
- Added `vercel-build` script for Vercel-specific builds
- Added `resolutions` and `overrides` to force compatible package versions

### 3. Updated `vercel.json`
- Changed install command to use `--legacy-peer-deps`
- Updated build command to use `vercel-build` script

## Deployment Steps

### Option 1: Push to GitHub (Recommended)

1. **Commit and push these changes:**
   ```bash
   git add .
   git commit -m "Fix: Resolve npm peer dependency conflicts for Vercel deployment"
   git push origin main
   ```

2. **Vercel will automatically redeploy** from GitHub

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI (if not installed):**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   # Preview deployment
   vercel

   # Production deployment
   vercel --prod
   ```

## Environment Variables Required

Before deploying, ensure these environment variables are set in Vercel:

### Essential Variables
```bash
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://your-domain.vercel.app
REDIS_URL=rediss://...
OPENAI_API_KEY=sk-...
```

### Optional but Recommended
```bash
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
APIFY_TOKEN=...
PINECONE_API_KEY=...
SLACK_WEBHOOK_URL=...
NEXT_PUBLIC_SENTRY_DSN=...
```

## Setting Environment Variables in Vercel

1. Go to your project in Vercel Dashboard
2. Click "Settings" → "Environment Variables"
3. Add each variable with:
   - **Key**: Variable name (e.g., `DATABASE_URL`)
   - **Value**: Variable value
   - **Environment**: Select "Production" (and optionally "Preview" and "Development")

## Troubleshooting

### If build still fails:

1. **Check build logs** in Vercel dashboard
2. **Clear build cache** in Vercel:
   - Go to Settings → General
   - Scroll to "Build & Development Settings"
   - Click "Clear Build Cache"

3. **Redeploy** after clearing cache

### Common Issues

**Issue: Prisma Client not generated**
- Solution: The `postinstall` script should handle this automatically

**Issue: Environment variables not found**
- Solution: Double-check all required variables are set in Vercel dashboard

**Issue: Database connection fails**
- Solution: Ensure DATABASE_URL includes `?pgbouncer=true&connection_limit=1` for Supabase

**Issue: Build timeout**
- Solution: Upgrade to Vercel Pro plan (longer build times) or optimize dependencies

## Verify Deployment

After successful deployment:

1. **Check health endpoint:**
   ```bash
   curl https://your-domain.vercel.app/api/health
   ```

2. **Expected response:**
   ```json
   {
     "status": "healthy",
     "services": {
       "database": { "status": "up" },
       "redis": { "status": "up" }
     }
   }
   ```

## Next Steps After Deployment

1. Test authentication at `/dashboard`
2. Create a test workflow
3. Monitor logs in Vercel dashboard
4. Set up custom domain (optional)
5. Configure Sentry for error tracking

## Support

If you encounter issues:
- Check `docs/DEPLOYMENT.md` for detailed guide
- Review Vercel build logs
- Check GitHub Actions CI/CD logs

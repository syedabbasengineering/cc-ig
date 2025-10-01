# 🚀 Deployment Checklist for Vercel

**Complete these steps to deploy your AI Content Automation app to production.**

---

## ✅ Step 1: Create Database (PostgreSQL) - 2 minutes

### Option A: Supabase (Recommended - Free Tier)

1. **Sign up**: Go to https://supabase.com and click "Start your project"
2. **Create project**:
   - Project name: `cc-ig-production` (or any name)
   - Database password: **Save this password!** You'll need it
   - Region: Choose closest to your users
   - Click "Create new project" (takes ~2 minutes)

3. **Get connection string**:
   - Once project is ready, go to **Project Settings** (gear icon)
   - Click **Database** in left sidebar
   - Scroll to **Connection string**
   - Select **URI** tab
   - **IMPORTANT**: Toggle **"Use connection pooling"** to ON
   - Copy the connection string (looks like):
     ```
     postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
     ```
   - Replace `[password]` with your actual database password

4. **Save this as**: `DATABASE_URL` ✅

### Option B: Neon (Alternative - Free Tier)

1. Go to https://neon.tech
2. Sign up and create new project
3. Copy the connection string from dashboard
4. Save as `DATABASE_URL`

---

## ✅ Step 2: Create Redis (For Queues) - 2 minutes

### Upstash Redis (Free Tier - Perfect for this app)

1. **Sign up**: Go to https://console.upstash.com/login
2. **Create database**:
   - Click "Create Database"
   - Name: `cc-ig-redis`
   - Type: Regional
   - Region: Choose same as your database (or closest)
   - TLS: **Enable** (required for production)
   - Click "Create"

3. **Get connection string**:
   - Click on your database
   - Scroll to **REST API** section
   - Copy **UPSTASH_REDIS_REST_URL** (looks like):
     ```
     rediss://default:[password]@gusc1-intent-12345.upstash.io:6379
     ```

4. **Save this as**: `REDIS_URL` ✅

---

## ✅ Step 3: Generate Authentication Secret - 30 seconds

### Mac/Linux Users:

Open Terminal and run:
```bash
openssl rand -base64 32
```

Copy the output (example: `XqZ8vK3mN2pL9wR7yT5uV1sH4jF6gD0c`)

### Windows Users:

Use this online generator: https://generate-secret.vercel.app/32

### Save this as: `NEXTAUTH_SECRET` ✅

---

## ✅ Step 4: Get Your Vercel URL - 1 minute

### Option A: Use Vercel's Auto-Generated URL

For now, use a placeholder: `https://cc-ig.vercel.app`

After first deployment, Vercel will show your actual URL. You can update this variable later.

### Option B: If You Have a Custom Domain

Use your custom domain: `https://yourdomain.com`

### Save this as: `NEXTAUTH_URL` ✅

---

## ✅ Step 5: Gather Your Existing API Keys

You already have these - just have them ready:

1. **OPENROUTER_API_KEY**: Your OpenRouter API key (starts with `sk-or-v1-`)
2. **APIFY_TOKEN**: Your Apify token (starts with `apify_api_`)

---

## 📋 Step 6: Add Variables to Vercel Dashboard

Now add all 6 required variables to Vercel:

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Find your project**: Click on `cc-ig` (or your project name)
3. **Open Settings**: Click "Settings" tab
4. **Navigate to Environment Variables**: Click "Environment Variables" in left sidebar
5. **Add each variable**:

### Required Variables (Add these 6):

| Key | Value | Environment |
|-----|-------|-------------|
| `DATABASE_URL` | Paste from Supabase (Step 1) | ✓ Production |
| `REDIS_URL` | Paste from Upstash (Step 2) | ✓ Production |
| `NEXTAUTH_SECRET` | Paste generated secret (Step 3) | ✓ Production |
| `NEXTAUTH_URL` | Your Vercel URL (Step 4) | ✓ Production |
| `OPENROUTER_API_KEY` | Your OpenRouter key | ✓ Production |
| `APIFY_TOKEN` | Your Apify token | ✓ Production |

**For each variable:**
- Click "Add New"
- Enter Key (exact name from table)
- Paste Value
- Check ✓ **Production**
- Click "Save"

---

## ✅ Step 7: Deploy to Vercel

### If Connected to GitHub (Recommended):

1. Commit and push your latest changes:
   ```bash
   git add .
   git commit -m "Add production environment configuration"
   git push origin main
   ```

2. **Vercel will auto-deploy** from GitHub
3. Monitor deployment at: https://vercel.com/dashboard

### If Using Vercel CLI:

```bash
vercel --prod
```

---

## ✅ Step 8: Verify Deployment

Once deployment completes:

1. **Check deployment status** in Vercel dashboard
2. **Open your app** at the Vercel URL
3. **Test health endpoint**:
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

4. **Try logging in** at `/dashboard` with demo credentials:
   - Email: `demo@taskmaster.ai`
   - Password: `demo123`

---

## 🎯 Post-Deployment (Optional)

### Update NEXTAUTH_URL (If Using Auto-Generated URL)

1. Note your actual Vercel URL from deployment
2. Go to Vercel → Settings → Environment Variables
3. Find `NEXTAUTH_URL`
4. Click Edit → Update value with actual URL
5. Redeploy (Vercel → Deployments → Click ⋯ → Redeploy)

### Add Optional Features Later

You can add these later when needed:

- **Pinecone** (vector search)
- **Cloudinary** (image CDN)
- **Sentry** (error tracking)
- **Slack** (notifications)
- **Google Docs** (content export)

---

## ❗ Troubleshooting

### Deployment Fails: "Environment variable not found"

- Double-check variable names are EXACT (case-sensitive)
- Make sure all 6 required variables are added
- Try clearing Vercel cache: Settings → General → Clear Build Cache

### Database Connection Error

- Verify `DATABASE_URL` includes `?pgbouncer=true`
- Check Supabase project is not paused (free tier)
- Ensure IP whitelist allows all IPs (0.0.0.0/0)

### Redis Connection Error

- Verify `REDIS_URL` starts with `rediss://` (two S's for TLS)
- Check Upstash database is active
- Confirm Redis URL includes password

### Build Fails

- Check build logs in Vercel dashboard
- Ensure `npm run build` works locally
- Try: Settings → General → Clear Build Cache → Redeploy

---

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **Upstash Docs**: https://upstash.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Project Docs**: See `/docs/DEPLOYMENT.md` for detailed guide

---

## ✅ Final Checklist

Before deploying, verify:

- [ ] Created Supabase PostgreSQL database
- [ ] Created Upstash Redis database
- [ ] Generated NEXTAUTH_SECRET
- [ ] Have OPENROUTER_API_KEY ready
- [ ] Have APIFY_TOKEN ready
- [ ] Added all 6 variables to Vercel Dashboard
- [ ] Latest code pushed to GitHub
- [ ] Reviewed deployment logs

**Ready to deploy!** 🚀

---

## 💡 Pro Tips

1. **Use same region** for database and Redis (reduces latency)
2. **Save all credentials** in a password manager
3. **Test locally first** with `.env.local` file
4. **Monitor deployments** in Vercel dashboard
5. **Check logs** if anything fails

---

**Need Help?**
- Check full deployment guide: `/docs/DEPLOYMENT.md`
- Build troubleshooting: `BUILD_FIX_SUMMARY.md`
- Vercel support: https://vercel.com/support

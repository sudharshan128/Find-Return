# 🚀 Complete Render Deployment Guide - Trust-Based Lost & Found

**Last Updated:** January 30, 2026  
**Status:** Ready for Production Deployment  
**Estimated Time:** 15-20 minutes

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Deploy (Automated)](#quick-deploy-automated)
3. [Manual Deploy](#manual-deploy)
4. [Environment Variables](#environment-variables)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### ✅ Before You Start

- [ ] GitHub repository with latest code pushed
- [ ] Render account (https://render.com - free tier available)
- [ ] Supabase project with all tables and policies set up
- [ ] Supabase credentials ready:
  - Project URL
  - Anon/Public Key
  - Service Role Key (keep this secure!)
  - JWT Secret

### 📝 Get Your Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Settings** → **API**
4. Copy:
   - **Project URL**: `https://yrdjpuvmijibfilrycnu.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ⚠️ KEEP SECRET!
5. Click **Settings** → **Database** → **Connection string** for JWT Secret

---

## Quick Deploy (Automated)

### Option 1: Using render.yaml (Recommended)

1. **Push the `render.yaml` file to your repository:**
   ```bash
   git add render.yaml
   git commit -m "Add Render deployment config"
   git push
   ```

2. **Go to Render Dashboard:**
   - Visit https://dashboard.render.com
   - Click **"New +"** → **"Blueprint"**
   - Connect your GitHub repository
   - Select the repository with `render.yaml`
   - Click **"Apply"**

3. **Set Environment Variables:**
   
   Render will create both services but you need to manually set sensitive variables:
   
   **For Backend (trust-backend-api):**
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key ⚠️
   - `SUPABASE_JWT_SECRET`: Your Supabase JWT secret
   
   **For Frontend (trust-frontend):**
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

4. **Deploy:**
   - Both services will automatically deploy
   - Wait for green "Live" status (~5-10 minutes)

---

## Manual Deploy

### Step 1: Deploy Backend API

1. **Create New Web Service:**
   - Go to https://dashboard.render.com
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Select your repository

2. **Configure Service:**
   ```
   Name: trust-backend-api
   Environment: Node
   Region: Singapore (or nearest to you)
   Branch: main
   Root Directory: (leave empty)
   ```

3. **Build & Start Commands:**
   ```
   Build Command: cd backend/nodejs && npm install && npm run build
   Start Command: cd backend/nodejs && node dist/server.js
   ```

4. **Add Environment Variables:**
   
   Click **"Advanced"** → **"Add Environment Variable"**
   
   ```
   SUPABASE_URL=https://yrdjpuvmijibfilrycnu.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_JWT_SECRET=your-jwt-secret
   NODE_ENV=production
   PORT=3000
   FRONTEND_URL=https://your-frontend.onrender.com
   FRONTEND_ORIGIN=https://your-frontend.onrender.com
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ADMIN_RATE_LIMIT_MAX_REQUESTS=50
   TOTP_WINDOW=2
   ```

5. **Click "Create Web Service"**

6. **Wait for deployment** (~5 minutes)

7. **Copy your backend URL:** `https://trust-backend-api.onrender.com`

### Step 2: Deploy Frontend

1. **Create New Static Site:**
   - Click **"New +"** → **"Static Site"**
   - Connect your GitHub repository
   - Select your repository

2. **Configure Service:**
   ```
   Name: trust-frontend
   Branch: main
   Root Directory: (leave empty)
   ```

3. **Build Command:**
   ```
   cd frontend && npm install && npm run build
   ```

4. **Publish Directory:**
   ```
   frontend/dist
   ```

5. **Add Environment Variables:**
   ```
   VITE_SUPABASE_URL=https://yrdjpuvmijibfilrycnu.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_API_URL=https://trust-backend-api.onrender.com
   ```

6. **Add Rewrite Rules:**
   - Click **"Redirects/Rewrites"**
   - Add rule:
     ```
     Source: /*
     Destination: /index.html
     Action: Rewrite
     ```

7. **Click "Create Static Site"**

8. **Wait for deployment** (~3-5 minutes)

### Step 3: Update Backend with Frontend URL

1. Go back to your **backend service**
2. Click **"Environment"**
3. Update these variables with your actual frontend URL:
   ```
   FRONTEND_URL=https://trust-frontend.onrender.com
   FRONTEND_ORIGIN=https://trust-frontend.onrender.com
   ```
4. Service will auto-redeploy

---

## Environment Variables

### Backend Environment Variables (Required)

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` | ✅ |
| `SUPABASE_ANON_KEY` | Public anon key | `eyJhbGc...` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key ⚠️ | `eyJhbGc...` | ✅ |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification | `your-secret` | ✅ |
| `NODE_ENV` | Environment mode | `production` | ✅ |
| `PORT` | Server port | `3000` | ✅ |
| `FRONTEND_URL` | Your frontend URL | `https://yourapp.com` | ✅ |
| `FRONTEND_ORIGIN` | CORS origin | `https://yourapp.com` | ✅ |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` | Optional |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` | Optional |
| `ADMIN_RATE_LIMIT_MAX_REQUESTS` | Admin rate limit | `50` | Optional |
| `TOTP_WINDOW` | 2FA time window | `2` | Optional |

### Frontend Environment Variables (Required)

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Public anon key | `eyJhbGc...` | ✅ |
| `VITE_API_URL` | Backend API URL | `https://api.onrender.com` | ✅ |

---

## Post-Deployment Verification

### 1. Test Backend Health

```bash
curl https://your-backend.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T10:30:00.000Z",
  "environment": "production"
}
```

### 2. Test Frontend

1. Visit your frontend URL: `https://your-frontend.onrender.com`
2. Check browser console (F12) for errors
3. Try logging in with Google OAuth
4. Check if items are loading

### 3. Test Admin Panel

1. Visit: `https://your-frontend.onrender.com/admin/login`
2. Login with authorized admin Google account
3. Verify 2FA prompt appears
4. Complete 2FA setup
5. Access admin dashboard

### 4. Verify CORS

```bash
curl -H "Origin: https://your-frontend.onrender.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-backend.onrender.com/api/admin/auth/verify
```

**Expected:** Response with CORS headers

### 5. Check Logs

**Backend Logs:**
- Go to Render Dashboard → Backend Service → Logs
- Look for:
  - `Server running on port 3000`
  - No error messages
  - Successful Supabase connections

**Frontend Logs:**
- Open browser console (F12)
- Check for:
  - No 404 errors
  - No CORS errors
  - Successful API calls

---

## Troubleshooting

### Issue: "Something went wrong" on login

**Causes:**
1. OAuth redirect URI not configured in Supabase
2. Google OAuth not set up correctly

**Fix:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add redirect URLs:
   ```
   https://your-frontend.onrender.com
   https://your-frontend.onrender.com/auth/callback
   https://your-frontend.onrender.com/admin/auth/callback
   ```
3. Go to Google Cloud Console → OAuth 2.0 Client IDs
4. Add authorized redirect URIs:
   ```
   https://yrdjpuvmijibfilrycnu.supabase.co/auth/v1/callback
   ```

### Issue: CORS errors

**Symptoms:**
- Browser console shows: `Access to fetch blocked by CORS policy`

**Fix:**
1. Verify `FRONTEND_URL` and `FRONTEND_ORIGIN` in backend exactly match your frontend URL
2. No trailing slash: `https://app.com` not `https://app.com/`
3. Redeploy backend after changing

### Issue: 500 Internal Server Error

**Check:**
1. Backend logs in Render Dashboard
2. Verify all environment variables are set
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
4. Check Supabase is accessible

### Issue: Frontend shows blank page

**Fix:**
1. Check browser console for errors
2. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Verify `VITE_API_URL` points to your backend
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: Images not loading

**Check:**
1. Supabase Storage buckets are public
2. RLS policies allow public read access
3. Image URLs are correct in database

---

## Custom Domain (Optional)

### Add Custom Domain to Frontend

1. In Render Dashboard → Frontend Service
2. Click **"Settings"** → **"Custom Domain"**
3. Click **"Add Custom Domain"**
4. Enter your domain: `yourdomain.com`
5. Follow DNS instructions (add CNAME record)
6. Wait for SSL certificate (~5 minutes)

### Add Custom Domain to Backend

1. In Render Dashboard → Backend Service
2. Click **"Settings"** → **"Custom Domain"**
3. Add: `api.yourdomain.com`
4. Update frontend environment variable:
   ```
   VITE_API_URL=https://api.yourdomain.com
   ```
5. Update backend environment variables:
   ```
   FRONTEND_URL=https://yourdomain.com
   FRONTEND_ORIGIN=https://yourdomain.com
   ```

---

## Monitoring & Maintenance

### Enable Auto-Deploy

- Go to Service → Settings
- Under "Build & Deploy"
- Enable **"Auto-Deploy"** on `main` branch
- Every push to `main` will trigger a new deployment

### Monitor Service Health

- Render provides automatic health checks
- Check Dashboard for uptime metrics
- Set up email alerts for downtime

### Database Backups

- Supabase automatically backs up your database
- Go to Supabase Dashboard → Database → Backups
- Configure backup retention as needed

---

## Cost Estimate

### Free Tier (Development)
- Frontend: Free (static site)
- Backend: Free (750 hrs/month, spins down after inactivity)
- **Total:** $0/month

### Starter Plan (Production)
- Frontend: Free (static site)
- Backend: $7/month (always on, no spin down)
- **Total:** $7/month

### Professional (High Traffic)
- Frontend: $0-$19/month (CDN + bandwidth)
- Backend: $25/month (more CPU/RAM)
- **Total:** $25-$44/month

---

## Next Steps After Deployment

1. ✅ Test all user flows thoroughly
2. ✅ Set up monitoring and alerts
3. ✅ Configure custom domain
4. ✅ Enable auto-deploy from GitHub
5. ✅ Set up staging environment (optional)
6. ✅ Configure error tracking (Sentry, LogRocket, etc.)
7. ✅ Add analytics (Google Analytics, Plausible, etc.)

---

## Support & Resources

- **Render Docs:** https://render.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Your Backend Health:** `https://your-backend.onrender.com/health`
- **Render Discord:** https://render.com/discord

---

## Checklist

- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] All environment variables configured
- [ ] OAuth redirect URIs updated in Supabase
- [ ] Google OAuth redirect URIs updated
- [ ] Health check passing
- [ ] Can login with Google
- [ ] Admin 2FA working
- [ ] Items loading correctly
- [ ] Images displaying
- [ ] Chat system functional
- [ ] Custom domain configured (optional)
- [ ] Auto-deploy enabled

---

**✨ Congratulations! Your Trust-Based Lost & Found platform is now live on Render!**

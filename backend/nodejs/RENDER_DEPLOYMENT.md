# Render Deployment Guide

## 🚀 Quick Deploy to Render

### Prerequisites
- GitHub account with repository pushed
- Render account (free or paid)
- Supabase project credentials
- Frontend already deployed

---

## Step 1: Create Render Service

1. Go to **https://render.com/dashboard**
2. Click **"New +"** → **"Web Service"**
3. Select your GitHub repository
4. Configure:
   - **Name:** `trust-api` (or your choice)
   - **Environment:** `Node`
   - **Build Command:**
     ```
     cd backend/nodejs && npm install && npm run build
     ```
   - **Start Command:**
     ```
     node dist/server.js
     ```
   - **Instance Type:** Free tier OK for development

---

## Step 2: Add Environment Variables

In Render dashboard:

1. Go to your service
2. Click **"Environment"**
3. Add each variable:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_JWT_SECRET=your-jwt-secret
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-frontend.com
FRONTEND_ORIGIN=https://your-frontend.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ADMIN_RATE_LIMIT_MAX_REQUESTS=50
TOTP_WINDOW=2
```

⚠️ **CRITICAL:** Never commit `.env` to GitHub!

---

## Step 3: Deploy

1. Click **"Create Web Service"**
2. Render auto-builds and deploys
3. Wait for green checkmark ("Live")
4. Your API is at: `https://your-service-name.onrender.com`

---

## Step 4: Verify Deployment

```bash
# Test health check
curl https://your-service-name.onrender.com/health

# Should return:
# { "status": "healthy", "timestamp": "..." }
```

---

## Connecting Frontend

Update frontend `.env`:

```
VITE_API_URL=https://your-service-name.onrender.com
```

Then in your API calls:

```javascript
const response = await fetch(
  `${import.meta.env.VITE_API_URL}/api/admin/auth/verify`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseToken}`
    }
  }
);
```

---

## 🔍 Monitoring

### View Logs

In Render dashboard:
1. Click your service
2. Click **"Logs"** tab
3. See real-time logs

### Common Issues

**Issue: "Build failed"**
- Check build command
- Verify `backend/nodejs/package.json` exists
- Check for TypeScript errors: `npm run type-check`

**Issue: "Service crashed"**
- Check logs for errors
- Verify all env vars are set
- Restart service

**Issue: "503 Service Unavailable"**
- Render might be restarting
- Wait 1-2 minutes
- Check health endpoint

---

## 🚀 Production Checklist

Before deploying to production:

- [ ] All environment variables set correctly
- [ ] Frontend CORS origin matches `FRONTEND_ORIGIN`
- [ ] Tested locally: `npm run dev`
- [ ] Built successfully: `npm run build`
- [ ] Health check working: `/health`
- [ ] JWT token verified with real Supabase token
- [ ] Admin user in `admin_users` table with `is_active=true`
- [ ] Rate limiting configured
- [ ] Audit logs working (check Supabase)

---

## 💰 Cost Optimization

Render free tier includes:
- ✅ 1 web service
- ✅ 0.5 CPU, 0.5 GB RAM
- ✅ 100 GB bandwidth/month
- ✅ Auto-sleep after 15 min inactivity

Paid tier: $7+/month for persistent service

---

## ⚙️ Advanced Configuration

### Custom Domain

1. In Render dashboard: **Settings** → **Custom Domain**
2. Add your domain: `api.yourdomain.com`
3. Update DNS records (Render will show instructions)
4. Update frontend `VITE_API_URL`

### Auto-Deploy on Push

Render automatically deploys when you push to main branch (if configured).

To disable:
1. Settings → Auto-Deploy
2. Toggle off

---

## 🔒 Security Reminders

1. **Never commit `.env` to GitHub**
2. **Service role key is SECRET** - never expose to frontend
3. **Rotate keys regularly** in Supabase dashboard
4. **Monitor audit logs** for suspicious activity
5. **Keep dependencies updated** - run `npm audit`

---

## 📞 Support

If deployment fails:

1. Check Render logs (they're very detailed)
2. Verify all env vars are set
3. Run `npm run build` locally to catch errors
4. Check Supabase credentials
5. Render support: support@render.com

---

**Your API is now live on Render! 🎉**

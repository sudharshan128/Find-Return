# 🚀 PHASE 3 PRODUCTION DEPLOYMENT: Render Deployment Checklist

**Status:** Pre-Deployment  
**Environment:** Render.com (nodejs)  
**Risk Level:** 🟡 MEDIUM (requires verification)  
**Rollback Time:** <5 minutes  

---

## ✅ PRE-DEPLOYMENT VERIFICATION

### Step 1: Render Environment Variables Setup

**Location:** Render Dashboard → Service → Environment

**Required Variables for 2FA:**

```
SUPABASE_URL=https://yrdjpuvmijibfilrycnu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

NODE_ENV=production
PORT=3000

FRONTEND_URL=https://yourdomain.com  (NOT localhost)
FRONTEND_ORIGIN=https://yourdomain.com  (CRITICAL for CORS)

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ADMIN_RATE_LIMIT_MAX_REQUESTS=50
```

### ⚠️ CRITICAL: Service Role Key

**What is it?** Backend-only key with unrestricted database access  
**Where it goes?** ONLY in backend `.env` and Render environment  
**Who has access?** ONLY backend server (never frontend)  
**Exposure risk?** CRITICAL - if leaked, database fully compromised

**Verification Steps:**

```bash
# 1. Verify local .env doesn't have unencrypted secrets
cd backend/nodejs
cat .env | grep SERVICE_ROLE
# You see: SUPABASE_SERVICE_ROLE_KEY=<value>

# 2. Verify .env is in .gitignore
cd d:\Dream project\Return
cat .gitignore | grep ".env"
# Expected: .env
# Expected: .env.local
```

**Render-Specific Setup:**

1. Open Render Dashboard
2. Select your backend service
3. Click "Environment"
4. Add each variable from above
5. **DO NOT** add quotes around values
6. **DO NOT** commit secrets to GitHub
7. Verify with: `echo $SUPABASE_SERVICE_ROLE_KEY` in logs

### Step 2: Verify Build Command

**Current setting:**
```
Build Command: npm run build
```

**What this does:**
```bash
npm run build  # Runs: tsc
# Compiles TypeScript to JavaScript
# Creates dist/server.js
# Fails if TypeScript errors
```

**Verification:**
```bash
cd backend/nodejs
npm run build
# Expected: No output (success) or error messages (failure)
# Files created: dist/ directory with .js files
```

**GO:** ✅ If no errors  
**NO-GO:** ❌ If errors - fix before deployment

### Step 3: Verify Start Command

**Current setting:**
```
Start Command: npm start
```

**What this does:**
```bash
npm start  # Runs: node dist/server.js
# Starts the compiled Node.js server
# Listens on PORT (default 3000)
# Connects to Supabase
```

**Local verification:**
```bash
cd backend/nodejs
npm run build  # Compile first
npm start      # Start server

# Expected output:
# Server running on port 3000
# [AUTH] Database connected
# [2FA] Service initialized
# No errors
```

**GO:** ✅ If server starts cleanly  
**NO-GO:** ❌ If connection errors - check env vars

### Step 4: Verify Node.js Version

**Required:** Node.js >= 20.0.0

**Check package.json:**
```json
"engines": {
  "node": ">=20.0.0"
}
```

**In Render:**
1. Go to Service settings
2. Find "Node Version" setting
3. Verify it's set to 20.x or higher
4. If not, update it

**GO:** ✅ If >= 20.0.0  
**NO-GO:** ❌ If < 20.0.0 - update in Render

---

## 🔐 BACKEND-ONLY SECURITY VERIFICATION

### Verify Service Role Key Isolation

**The risk:** Service role key gives full database access

**How to prevent misuse:**

```typescript
// ✅ CORRECT: Backend-only
// File: src/services/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Uses SUPABASE_SERVICE_ROLE_KEY (backend)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ← BACKEND ONLY
);

// ❌ WRONG: Never expose in API responses
// BAD: res.json({ serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY })
```

**Verify in code:**

```bash
# Search for leaks of service role key
cd backend/nodejs
grep -r "SUPABASE_SERVICE_ROLE_KEY" src/ --include="*.ts"

# Expected output:
# src/services/supabase.ts:... process.env.SUPABASE_SERVICE_ROLE_KEY!

# Should NOT appear in:
# src/routes/... (API responses)
# src/middleware/... (sent to client)
```

**Verify frontend doesn't have it:**

```bash
# Frontend should only have ANON_KEY
cd frontend
grep -r "SUPABASE" src/ --include="*.jsx" --include="*.js"

# Should see:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY

# Should NOT see:
# SERVICE_ROLE
# SUPABASE_JWT_SECRET
```

**GO:** ✅ Service role key isolated to backend  
**NO-GO:** ❌ Service role key found in frontend code

---

## 🔌 RENDER-SPECIFIC 2FA CONSIDERATIONS

### Consideration 1: JWT Token Verification

**In Production:**

```typescript
// src/middleware/requireAuth.ts
const SECRET = process.env.SUPABASE_JWT_SECRET;

// This verifies tokens are from your Supabase instance
jwt.verify(token, SECRET);
```

**Render Environment:**
- ✅ SUPABASE_JWT_SECRET must be in environment
- ✅ Must match your Supabase project
- ✅ Used to verify OAuth tokens

**Verify:**
```bash
# Check Supabase dashboard
# Settings → API → JWT Secret
# Copy and paste into Render environment
```

### Consideration 2: CORS Configuration

**Current (Local):**
```typescript
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5174",
  process.env.FRONTEND_ORIGIN || "http://localhost:5174",
];
```

**Must change for production:**
```
FRONTEND_URL=https://yourdomain.com
FRONTEND_ORIGIN=https://yourdomain.com
```

**If CORS is wrong:**
- ❌ Frontend can't reach backend
- ❌ OAuth tokens can't be verified
- ❌ 2FA verification fails (401 errors)

**Verify in Render logs:**
```
[CORS] Request from http://localhost:5174 - BLOCKED
[CORS] Expected origin: https://yourdomain.com
```

**If you see this:** Update FRONTEND_ORIGIN in Render

### Consideration 3: Rate Limiting on Render

**Current configuration:**
```
RATE_LIMIT_WINDOW_MS=900000      (15 min)
RATE_LIMIT_MAX_REQUESTS=100      (general)
ADMIN_RATE_LIMIT_MAX_REQUESTS=50 (admin-specific)
```

**2FA-specific rate limiting:**
```typescript
// src/middleware/rateLimit.ts
const twoFALimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 3,                     // 3 attempts
  message: "Too many failed 2FA attempts"
});
```

**On Render (multi-instance):**
- ⚠️ Rate limiting is in-memory (each instance has its own)
- ✅ Works fine for small user base
- ⚠️ If scaling to multiple instances, need Redis

**Current state:** ✅ Fine for < 1000 concurrent users

### Consideration 4: Database Connection Limits

**Supabase limits:**
- ✅ Up to 100 concurrent connections (free tier)
- ✅ Each request uses 1 connection
- ⚠️ 2FA adds small overhead (1-2 extra queries per login)

**Monitor:**
```sql
-- Check connection count (Supabase dashboard)
SELECT count(*) FROM pg_stat_activity;
-- Should be < 50 if healthy
```

### Consideration 5: Secret Rotation

**When to rotate:**
- After deploying (secrets now in Render)
- If secret is ever leaked
- Annually for compliance

**Rotation process:**
```
1. Generate new SUPABASE_JWT_SECRET (in Supabase)
2. Update SUPABASE_JWT_SECRET in Render
3. Restart service
4. Test login works
5. Old tokens might become invalid
```

---

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment (Do These NOW)

```
[ ] Verify all required environment variables in Render
[ ] Confirm NODE_ENV=production
[ ] Confirm FRONTEND_URL is production domain (not localhost)
[ ] Verify npm run build works locally
[ ] Verify npm start works locally
[ ] Check .env is in .gitignore
[ ] Confirm SUPABASE_SERVICE_ROLE_KEY is NOT in git
[ ] Verify JWT_SECRET matches Supabase
[ ] Test CORS settings with production frontend URL
[ ] Review Render logs for errors
```

### Render Build/Start Verification

**In Render Dashboard:**

```
Build Command:     npm run build
Start Command:     npm start
Node Version:      20.x or higher
Install Command:   npm ci (should auto-fill)
```

**Verify settings:**
1. Click Service
2. Click "Settings"
3. Find "Build Command" field
4. Should show: `npm run build`
5. Find "Start Command" field
6. Should show: `npm start`
7. Find "Node Version"
8. Should show: 20 or higher

### Environment Variable Verification

**Must have:**
- ✅ SUPABASE_URL
- ✅ SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY ← CRITICAL
- ✅ SUPABASE_JWT_SECRET
- ✅ NODE_ENV=production
- ✅ PORT=3000
- ✅ FRONTEND_URL (production domain)
- ✅ FRONTEND_ORIGIN (production domain)

**Verification command (in Render):**
```bash
# These commands should work in Render logs
env | grep SUPABASE
env | grep FRONTEND
env | grep NODE_ENV
```

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Final Local Verification

```bash
# Backend
cd backend/nodejs
npm run build     # Compile
npm start         # Test start

# Should output:
# Server running on port 3000
# [AUTH] Database connected
# [2FA] Service initialized

# Ctrl+C to stop
```

### Step 2: Push Code to GitHub

```bash
cd d:\Dream project\Return
git status  # Should be clean
git log --oneline -3  # Should show recent commits

# If all good:
git push origin main
# Wait for push to complete
```

### Step 3: Trigger Render Deployment

**Option A: Manual (Recommended for first deployment)**
1. Log into Render dashboard
2. Click your backend service
3. Click "Manual Deploy"
4. Select "main" branch
5. Click "Deploy"
6. Wait for build to start

**Option B: Automatic (if auto-deploy is enabled)**
- Just wait for Render to detect the push
- Should start within 1 minute

### Step 4: Monitor Build Progress

```
Expected timeline:
0-2 min: Cloning repository
2-5 min: Installing dependencies (npm install)
5-10 min: Building (npm run build)
10-15 min: Starting service
15+ min: Waiting for health check

Watch for:
✅ "Service is live" message
❌ "Build failed" message → Check logs
❌ "Start command failed" → Check env vars
```

**If build fails:**
```
1. Click "Logs" tab in Render
2. Scroll to bottom for error message
3. Fix issue locally
4. Commit and push to GitHub
5. Click "Manual Deploy" again
```

### Step 5: Verify Deployment Success

```bash
# Test backend health endpoint
curl https://your-render-service.onrender.com/health

# Expected response:
# { "status": "ok", "timestamp": "...", "version": "..." }

# If 502 Bad Gateway:
# - Service still starting (wait 2 min)
# - Check Render logs for errors

# If 401 Unauthorized:
# - Frontend CORS issue
# - Verify FRONTEND_ORIGIN in Render env
```

---

## 🎯 GO/NO-GO DECISION

### GO Criteria (All Must Pass):

```
[ ] npm run build completes without errors
[ ] npm start runs and listens on port 3000
[ ] All environment variables are in Render
[ ] SUPABASE_SERVICE_ROLE_KEY is isolated to backend
[ ] FRONTEND_URL is production domain
[ ] Service role key is NOT in git
[ ] Render build succeeds
[ ] Render service shows "live" status
[ ] Health endpoint responds ✅
```

### NO-GO Signals (Immediate stop if any):

```
[ ] TypeScript compilation errors
[ ] Supabase connection failures
[ ] Missing environment variables
[ ] Service role key in frontend code
[ ] CORS blocking errors
[ ] Build fails in Render
[ ] Service doesn't start
[ ] Health endpoint returns error
```

---

## 📞 COMMON RENDER PITFALLS

### Pitfall 1: Service Role Key Leak

**Symptom:** 401 errors, database access denied  
**Cause:** Service role key set to wrong value or missing  
**Fix:**
```
1. Go to Supabase dashboard
2. Copy SUPABASE_SERVICE_ROLE_KEY
3. Paste into Render environment
4. Restart service
5. Verify with: curl /health
```

### Pitfall 2: CORS Blocking

**Symptom:** Frontend can't reach backend, login fails  
**Cause:** FRONTEND_ORIGIN is localhost:5174 (dev setting)  
**Fix:**
```
1. In Render, set:
   FRONTEND_ORIGIN=https://yourdomain.com
2. Restart service
3. Test login again
```

### Pitfall 3: JWT Secret Mismatch

**Symptom:** Tokens rejected, 401 on every request  
**Cause:** SUPABASE_JWT_SECRET doesn't match Supabase  
**Fix:**
```
1. Supabase dashboard → Settings → API
2. Copy JWT Secret
3. In Render environment, update SUPABASE_JWT_SECRET
4. Restart service
5. Clear browser cache and retry login
```

### Pitfall 4: Port Mismatch

**Symptom:** Service starts but Render says no health check  
**Cause:** PORT environment variable wrong  
**Fix:**
```
1. In Render, set: PORT=3000
2. Restart service
3. Wait 2 minutes for health check
```

### Pitfall 5: npm start Command

**Symptom:** "Start command failed" error  
**Cause:** npm start is wrong  
**Fix:**
```
1. Verify package.json has:
   "start": "node dist/server.js"
2. Verify dist/ was created by build
3. Restart deployment
```

---

## ✅ FINAL PRE-DEPLOYMENT CHECKLIST

**Environment Variables (in Render):**
- [ ] SUPABASE_URL
- [ ] SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY (backend-only!)
- [ ] SUPABASE_JWT_SECRET
- [ ] NODE_ENV=production
- [ ] PORT=3000
- [ ] FRONTEND_URL=https://yourdomain.com
- [ ] FRONTEND_ORIGIN=https://yourdomain.com

**Build & Start (in Render):**
- [ ] Build Command: npm run build
- [ ] Start Command: npm start
- [ ] Node Version: 20.x

**Code Quality:**
- [ ] No TypeScript errors
- [ ] npm run build succeeds locally
- [ ] npm start works locally
- [ ] All changes committed to git
- [ ] Ready to push to GitHub

**Security:**
- [ ] Service role key NOT in git
- [ ] Service role key NOT in frontend
- [ ] .env is in .gitignore
- [ ] CORS configured correctly
- [ ] JWT secret matches Supabase

**When all items checked:** Ready for "Manual Deploy" in Render

---

**Next:** Go to PHASE_3_ENFORCE_ACTIVATION.md to attach middleware in production

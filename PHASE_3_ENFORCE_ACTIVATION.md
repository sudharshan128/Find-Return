# 🔐 PHASE 3 PRODUCTION: Safe 2FA Enforcement Activation

**Status:** After Render deployment succeeds  
**Scope:** Attach require2FA middleware to production routes  
**Risk Level:** 🟡 MEDIUM (requires validation)  
**Rollback Time:** <5 minutes (remove middleware line)  

---

## ✅ PRE-ACTIVATION VERIFICATION

### Verify: Production Environment Running

**Command (local terminal):**
```bash
# Test production backend
curl https://your-render-service.onrender.com/health

# Expected response:
# { "status": "ok", "timestamp": "2026-01-08T...", "version": "..." }
```

**If fails:**
- ❌ Service not deployed yet
- ❌ Service URL is wrong
- ❌ Render service not running
- **ACTION:** Complete PHASE_3_RENDER_DEPLOYMENT.md first

### Verify: Database Migration Applied

**Command (Supabase SQL Editor):**
```sql
-- Check 2FA columns exist
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'admin_users'
AND column_name LIKE 'twofa%';

-- Expected results: 4 rows
-- twofa_enabled
-- twofa_secret
-- twofa_verified_at
-- twofa_backup_codes
```

**If fails:**
- ❌ Database migration not applied
- **ACTION:** Apply migration to Supabase first

### Verify: Middleware File Exists in Production

**Command (GitHub):**
```bash
# Check middleware exists in main branch
git show main:backend/nodejs/src/middleware/require2fa.ts | head -20

# Expected: Should see middleware code
```

**If fails:**
- ❌ Middleware not committed to git
- ❌ Render deployed old code
- **ACTION:** Commit middleware, push to GitHub, redeploy Render

### Verify: Code is at Latest Commit

**Command (local):**
```bash
cd d:\Dream project\Return
git log --oneline -1

# Should be: 04ea9b5 (or later)
# Latest phase 3 changes

# Push to GitHub:
git push origin main
```

**If not latest:**
- ❌ Local code not pushed
- **ACTION:** `git push origin main` first

---

## 🎯 MIDDLEWARE ORDER VERIFICATION (CRITICAL)

### The Correct Order:

```typescript
// src/middleware/requireAuth.ts
export const requireAuth = async (req, res, next) => {
  // 1. Check JWT token exists
  // 2. Verify token signature
  // 3. Get user profile
  // Store: req.user, req.adminProfile
}

export const requireSuperAdmin = (req, res, next) => {
  // 3. Check user.role === 'super_admin'
  // If not → 403 Forbidden
}

// src/middleware/require2fa.ts
export const require2FA = async (req, res, next) => {
  // 4. Check if 2FA is enabled for this admin
  // If enabled but NOT verified → 401
  // Otherwise → next()
}
```

### In Routes:

```typescript
// ✅ CORRECT ORDER:
router.get(
  "/admin/audit-logs",
  adminLimiter,           // 1. Rate limiting
  requireAuth,            // 2. Check JWT
  requireSuperAdmin,      // 3. Check role
  require2FA,             // 4. Check 2FA (LAST!)
  async (req, res) => {
    // Handler
  }
);
```

**Why this order matters:**

| Step | Purpose | If skipped |
|------|---------|-----------|
| 1. requireAuth | Verify JWT token | Unauthenticated users pass through! |
| 2. requireSuperAdmin | Verify role | Non-admins access super_admin routes! |
| 3. require2FA | Verify 2FA | Users bypass 2FA! |

**GO:** ✅ If order is correct  
**NO-GO:** ❌ If require2FA is before requireSuperAdmin

---

## 🔍 VERIFY ADMIN ROUTES PROTECTION

### Step 1: Check Which Routes Need 2FA

**In production, these routes should have require2FA:**

```typescript
// Routes with requireSuperAdmin = need 2FA

// Sensitive routes:
router.get("/audit-logs", requireAuth, requireSuperAdmin, require2FA, ...)
router.get("/login-history", requireAuth, requireSuperAdmin, require2FA, ...)

// Optional (less sensitive):
// router.post("/admin/users/reset-password", ...)
// router.delete("/admin/users/:id", ...)
```

**Strategy: Start Conservative**
- ✅ Attach require2FA to audit-logs only (most sensitive)
- ✅ Verify it works for 24 hours
- ✅ Then expand to other super_admin routes

**Why?**
- Minimal risk (only 1 route affected)
- Easy to rollback (remove 1 line)
- Easy to test (audit logs easy to verify)

### Step 2: Code Change in Production

**File:** `backend/nodejs/src/routes/admin.routes.ts`

**Current state (in your main branch):**
```typescript
import { require2FA } from "../middleware/require2fa";  // Already imported

// Audit logs route (line ~247)
router.get(
  "/audit-logs",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  require2FA,  // Already added
  async (req, res) => { ... }
);
```

**Verify in git:**
```bash
cd backend/nodejs
git log --oneline | head -5
# Should show: 04ea9b5 (or later with require2FA changes)

git show HEAD:src/routes/admin.routes.ts | grep -A5 "audit-logs"
# Should show require2FA in the route
```

**If require2FA is NOT in main branch:**
- ❌ Code changes not pushed to GitHub
- **ACTION:** 
  ```bash
  git push origin main
  # Then: Manual Deploy in Render
  # Wait for deployment
  ```

### Step 3: Verify Deployment Contains Changes

**In Render Logs:**
```
1. Go to Render dashboard
2. Click your service
3. Click "Logs" tab
4. Look for build log messages
5. Should see: "running tsc" (TypeScript compile)
6. Should end with: "Service is live"
```

**If you see errors:**
- ❌ Build failed
- **ACTION:** Check logs for error, fix locally, push again

---

## ✅ VERIFY NON-SUPER-ADMINS BYPASS CORRECTLY

### The Safety Net: Middleware Bypass Logic

**In require2fa.ts middleware:**

```typescript
export async function require2FA(req, res, next) {
  // Get user role
  const role = req.adminProfile?.role;

  // Safety check 1: If not super_admin, skip 2FA
  if (role !== "super_admin") {
    console.log("[2FA] Non-super-admin, bypassing 2FA");
    return next();  // ← Allow through!
  }

  // Only check 2FA for super_admins
  const twoFAStatus = await supabase.get2FAStatus(adminId);
  
  // Safety check 2: If 2FA not enabled, allow
  if (!twoFAStatus?.enabled) {
    console.log("[2FA] 2FA not enabled, allowing access");
    return next();  // ← Allow through!
  }

  // Only deny if super_admin with 2FA enabled but NOT verified
  if (!req.verified2FAAt) {
    console.log("[2FA] 2FA required but not verified");
    return res.status(401).json({ code: "2FA_REQUIRED" });
  }

  // Allow if verified
  return next();
}
```

**Test this in production:**

1. **Login as Moderator/Analyst:**
   ```bash
   # Go to production frontend
   # Click "Sign in with Google"
   # Use moderator@example.com account
   
   # Expected:
   # ✅ No 2FA screen
   # ✅ Redirects to dashboard
   # ✅ Can access all routes
   ```

2. **Check Render logs:**
   ```
   [2FA] Non-super-admin, bypassing 2FA
   [MIDDLEWARE] requireSuperAdmin → User lacks permission
   ```

3. **Try accessing /admin/audit-logs:**
   ```bash
   # Logged in as moderator
   # Try: curl -H "Authorization: Bearer $TOKEN" https://...:3000/audit-logs
   
   # Expected response:
   # 403 Forbidden (missing super_admin role)
   # NOT a 401 (which would be 2FA issue)
   ```

**GO:** ✅ Moderators bypass 2FA correctly  
**NO-GO:** ❌ 401 error (2FA middleware failing) or ✅ 403 error (role check, correct)

---

## 🔐 MIDDLEWARE ATTACHMENT DECISION

### Option A: Audit Logs Only (RECOMMENDED - Conservative)

```typescript
// Attach require2FA to audit-logs route ONLY
router.get(
  "/audit-logs",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  require2FA,  // ← Only here
  async (req, res) => { ... }
);
```

**Advantages:**
- ✅ Minimal risk (1 route only)
- ✅ Easy to test (audit logs are easy to verify)
- ✅ Easy to rollback (remove 1 line)
- ✅ Can monitor for 24 hours
- ✅ Can expand later if stable

**Disadvantages:**
- ⚠️ Login history unprotected (still has requireSuperAdmin)
- ⚠️ Other routes unprotected (can expand later)

**Timeline:**
- Day 1: Deploy with require2FA on audit-logs
- Hour 1-2: Verify super_admins can access with 2FA
- Hour 2-24: Monitor logs, no errors
- Day 2: Add to login-history route
- Day 3: Verify logs, expand to other routes

### Option B: All Super-Admin Routes (AGGRESSIVE)

```typescript
// Attach require2FA to ALL requireSuperAdmin routes
router.get("/audit-logs", ..., require2FA, ...)
router.get("/login-history", ..., require2FA, ...)
router.post("/admin/config", ..., require2FA, ...)
// etc.
```

**Advantages:**
- ✅ All sensitive routes protected immediately

**Disadvantages:**
- ⚠️ Higher risk (multiple routes affected)
- ⚠️ More complex testing needed
- ⚠️ Harder to debug if issues arise

**Recommendation:** Start with Option A, expand to Option B after 24 hours of successful logs

---

## 📋 ACTIVATION CHECKLIST

### Before Attaching Middleware:

```
[ ] Production health endpoint responds ✅
[ ] Database migration applied (4 columns exist)
[ ] Middleware file in GitHub main branch
[ ] Render deployed latest code
[ ] No TypeScript errors in logs
[ ] Service is "live" status
```

### Middleware Attachment:

```
[ ] Choose Option A (audit-logs only) ← RECOMMENDED
[ ] Verify require2FA import exists
[ ] Verify require2FA is in correct position (after requireSuperAdmin)
[ ] Verify middleware is imported: import { require2FA } from "..."
[ ] npm run build succeeds locally
[ ] npm start works locally
[ ] git push origin main
[ ] Render detects push and starts deploy
[ ] Build completes successfully
```

### Post-Attachment Verification:

```
[ ] Service shows "live" status
[ ] Health endpoint still works: /health
[ ] Can login as super_admin with 2FA
[ ] Can access /audit-logs with 2FA
[ ] 2FA screen appears during login
[ ] Code verification works
[ ] Can login as super_admin without 2FA
[ ] Can login as moderator (no 2FA)
[ ] No errors in Render logs
```

---

## 🎯 GO/NO-GO DECISION

### GO Criteria (All Must Pass):

```
[ ] Production backend running and healthy
[ ] Database migration applied
[ ] Code is latest (04ea9b5 or later)
[ ] Middleware is imported in routes
[ ] require2FA is in correct position
[ ] Build succeeds locally and in Render
[ ] Service status is "live"
[ ] Health endpoint responds
[ ] Ready to verify (go to 15-MIN VERIFICATION checklist)
```

### NO-GO Signals (STOP if any):

```
[ ] Service fails to deploy
[ ] Build errors in Render logs
[ ] 502 Bad Gateway
[ ] Health endpoint returns error
[ ] Database connection failed
[ ] require2FA not in code
[ ] Wrong middleware order
```

---

**Next:** Go to PHASE_3_POST_DEPLOY_VERIFICATION.md to run 15-minute checklist

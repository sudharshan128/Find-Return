# 🔐 STEP 2.4: ENABLE 2FA MIDDLEWARE (ACTIVATION)

**Status:** 🟢 READY TO ACTIVATE  
**Risk Level:** 🟡 MEDIUM (Single point of failure - requires testing)  
**Rollback Time:** <5 minutes (remove middleware, redeploy)  
**Time to Deploy:** ~30 seconds  

---

## ⚠️ BEFORE PROCEEDING

### MUST COMPLETE:
- [ ] Database migration applied & verified ✅
- [ ] Backend compiles without errors ✅
- [ ] Frontend builds without errors (TODO: check)
- [ ] All 4 local test cases pass (TODO: run before deployment)
- [ ] Rollback plan tested (TODO: test)

### CRITICAL: Do NOT attach middleware without these:
- ❌ Missing verification of 4 test scenarios
- ❌ Rate limiting not tested
- ❌ Audit logging not verified
- ❌ 2FA users account not set up for testing

---

## 🎯 WHAT THIS STEP DOES

Attaches the `require2FA` middleware to admin routes, making 2FA enforcement ACTIVE.

**Before this step:** 2FA APIs exist but are OPTIONAL  
**After this step:** 2FA enforcement REQUIRED for super_admin dashboard access  

---

## 📋 THE ACTIVATION CHANGES

### File 1: Update Admin Routes

**Location:** `backend/nodejs/src/routes/admin.routes.ts`

**Change:** Add middleware to protected routes

**BEFORE:**
```typescript
router.get(
  '/dashboard',
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    // dashboard logic
  }
);
```

**AFTER:**
```typescript
import { require2FA } from "../middleware/require2fa";

router.get(
  '/dashboard',
  requireAuth,
  requireSuperAdmin,
  require2FA,  // ← NEW: Enable 2FA enforcement
  async (req: Request, res: Response) => {
    // dashboard logic
  }
);
```

### File 2: Middleware Created ✅

**Location:** `backend/nodejs/src/middleware/require2fa.ts`

**Status:** ✅ Already created with all logic

**What it does:**
1. Checks user is authenticated
2. Checks user is super_admin
3. Gets 2FA status from database
4. If 2FA disabled → Allow access
5. If 2FA enabled but not verified → Deny (401)
6. If 2FA enabled AND verified → Allow access

---

## 🧪 MANDATORY TESTING (Before activation)

### Test Scenario 1: Super Admin WITHOUT 2FA Enabled

**Setup:**
- Use a test super_admin account
- Ensure 2FA is NOT enabled in database

**Steps:**
1. Navigate to `/admin/login`
2. Sign in with Google
3. **Expected:** OAuth completes → Redirects to /admin dashboard
4. **Expected:** NO 2FA screen shown
5. **Expected:** Dashboard loads successfully

**Fail Condition:** 2FA screen shown when shouldn't be

---

### Test Scenario 2: Super Admin WITH 2FA Enabled

**Setup:**
- Use a test super_admin account
- Enable 2FA (scan QR code, verify code)
- Database shows `twofa_enabled = true, twofa_verified_at = <timestamp>`

**Steps:**
1. Navigate to `/admin/login`
2. Sign in with Google
3. **Expected:** OAuth completes
4. **Expected:** 2FA verification screen shown
5. Enter 6-digit code from authenticator app
6. **Expected:** Code verified ✅
7. **Expected:** Redirects to /admin dashboard
8. **Expected:** Dashboard loads successfully

**Fail Condition:** 2FA screen not shown, OR valid code rejected

---

### Test Scenario 3: Moderator/Analyst

**Setup:**
- Use a test moderator or analyst account
- 2FA disabled (role != super_admin)

**Steps:**
1. Navigate to `/admin/login`
2. Sign in with Google
3. **Expected:** OAuth completes → Dashboard
4. **Expected:** NO 2FA screen shown
5. **Expected:** Dashboard loads successfully

**Fail Condition:** 2FA screen shown (should never be shown for non-super-admin)

---

### Test Scenario 4: Invalid 2FA Code (Rate Limiting)

**Setup:**
- Use super_admin account WITH 2FA enabled
- Prepare to enter wrong codes

**Steps:**
1. Sign in with Google
2. 2FA verification screen shown
3. Enter WRONG code → "Invalid code, 2 attempts remaining"
4. Enter WRONG code → "Invalid code, 1 attempt remaining"
5. Enter WRONG code → "Too many failed attempts, try again in 600 seconds"
6. **Expected:** Locked for 10 minutes
7. Check audit logs → See 3 failed attempts + 1 lockout event

**Fail Condition:** Wrong codes not counted, OR rate limit not enforced, OR audit logs missing

---

## 📋 ACTIVATION CHECKLIST

### Pre-Deployment:
- [ ] All 4 tests pass locally
- [ ] No errors in backend build
- [ ] No errors in frontend build
- [ ] Audit logs showing 2FA events
- [ ] Rate limiting working
- [ ] Rollback plan ready

### Deployment:
- [ ] Pull latest code
- [ ] npm run build (backend)
- [ ] npm run build (frontend)
- [ ] Push to Render (or your deployment)
- [ ] Verify deployment successful
- [ ] Check backend /health endpoint

### Post-Deployment:
- [ ] Monitor admin login errors
- [ ] Check audit logs for 2FA events
- [ ] Test login with 2FA account
- [ ] Keep debug logs ON for 24 hours
- [ ] Document any issues

---

## 🔄 ROLLBACK PLAN

If issues occur after deployment:

### Option 1: Quick Disable (5 minutes)
```bash
# Remove require2FA from routes
# Edit: backend/nodejs/src/routes/admin.routes.ts
# Delete: require2FA from the middleware chain

router.get(
  '/dashboard',
  requireAuth,
  requireSuperAdmin,
  // require2FA,  // ← REMOVE this line
  async (req, res) => { ... }
);

# Recompile and redeploy
npm run build
# Deploy to Render
```

### Option 2: Full Rollback (if needed)
```bash
# Reset to admin-pre-2fa tag
git reset --hard admin-pre-2fa
npm run build
# Deploy
```

### Option 3: Disable Database
```sql
-- Clear 2FA requirement from all users
UPDATE admin_users SET twofa_enabled = false WHERE role = 'super_admin';

-- Users can still enable 2FA, but it won't be enforced
-- This prevents lockouts while you investigate
```

---

## 🚨 CRITICAL: What CANNOT Break

### OAuth Flow
- Google Sign-in must work
- JWT issued correctly
- Token verified server-side

### Non-Super-Admin Users
- Must NOT see 2FA screen
- Must NOT be affected by 2FA changes

### Users WITHOUT 2FA Enabled
- Must NOT see 2FA screen
- Must NOT be blocked from access

### Rate Limiting
- Must enforce 3 attempts/10 min
- Must lock admin for 10 minutes
- Must log all attempts

### Audit Logging
- Must log all 2FA events
- Must include admin_id, timestamp, IP, user agent

---

## 📊 MONITORING (First 24 Hours)

After deployment, watch for:

### Error Rates:
- `/admin/login` errors (should be near 0)
- `/api/2fa/verify-login` 401s (expected for 2FA users)
- `/api/2fa/verify-login` 429s (expected when rate limited)

### Audit Logs:
- 2FA_VERIFY_ATTEMPT (success) - should see these
- 2FA_VERIFY_ATTEMPT (failure) - should see these
- 2FA_LOCKOUT - should NOT see many of these
- 2FA_REQUIRED - should see these for protected endpoints

### Application Behavior:
- Admin login takes ~5 seconds (normal)
- 2FA verification takes ~1 second (normal)
- No infinite loading states
- No browser console errors

---

## ✅ SUCCESS CRITERIA

Deployment is successful when:

✅ Super admin without 2FA: Logs in normally (no 2FA screen)  
✅ Super admin with 2FA: Logs in, sees 2FA screen, enters code, completes login  
✅ Moderator/analyst: Logs in normally (no 2FA screen)  
✅ Rate limiting: 3 wrong codes = locked for 10 min  
✅ Audit logs: All events logged with proper metadata  
✅ No errors in browser console  
✅ No infinite loading states  

---

## 🎯 NEXT STEPS (After Deployment)

Once 2FA is stable and verified:

### STEP 3: Local Testing (All 4 scenarios pass)
- Test super_admin without 2FA
- Test super_admin with 2FA
- Test moderator/analyst
- Test rate limiting and lockout

### STEP 4: Production Monitoring (24 hours)
- Monitor error logs
- Check audit logs
- Verify no infinite states
- Document issues

### Then: Phase 4+ (Future work)
- Recovery codes implementation
- Analytics dashboard
- Rate limiting expansion
- Final documentation

---

## 📞 IF ISSUES OCCUR

### Issue: Users stuck on 2FA screen
**Fix:** Delete `requires2FA` state from localStorage, refresh
**Root Cause:** Session mismatch

### Issue: 2FA screen not showing for super_admin with 2FA enabled
**Fix:** Check database - ensure `twofa_enabled = true` for admin
**Root Cause:** Database not updated correctly

### Issue: All logins failing
**Fix:** Rollback - remove require2FA middleware
**Root Cause:** Middleware blocking valid requests

### Issue: Audit logs not showing 2FA events
**Fix:** Check admin_audit_logs table, verify logAdminAction calls
**Root Cause:** Logging not working

---

## ✨ ACTIVATION SUMMARY

**This step:**
- Attaches `require2FA` middleware to `/admin/dashboard` route
- Makes 2FA enforcement ACTIVE
- Requires testing before deployment
- Has rollback plan if issues occur

**After this step:**
- Super admins with 2FA enabled MUST verify code after OAuth
- Non-super-admins bypass 2FA silently
- All attempts logged and rate-limited

**Ready to proceed?** Run the 4 test scenarios locally first! 🚀

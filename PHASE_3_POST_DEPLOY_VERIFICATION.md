# ✅ PHASE 3 PRODUCTION: 15-Minute Post-Deploy Verification

**When to run:** Immediately after Render deployment completes  
**Duration:** 15 minutes  
**Success criteria:** 5 tests pass  
**If any test fails:** Proceed to PHASE_3_EMERGENCY_DISABLE.md  

---

## 🚀 VERIFICATION SETUP (2 minutes)

### Open These in Separate Windows:

1. **Render Logs:**
   - Render dashboard → Your service → Logs tab
   - Keep scrolling to see live logs
   - Watch for errors/warnings

2. **Production Frontend:**
   - Navigate to: https://yourdomain.com/admin/login
   - Keep DevTools open (F12)
   - Check Console for errors

3. **Supabase SQL Editor:**
   - Open Supabase dashboard
   - Click SQL Editor
   - Have these queries ready:
     ```sql
     SELECT * FROM admin_audit_logs WHERE created_at > now() - interval '5 min' ORDER BY created_at DESC LIMIT 10;
     SELECT * FROM twofa_attempts WHERE updated_at > now() - interval '5 min' ORDER BY updated_at DESC;
     ```

4. **Terminal (optional):**
   ```bash
   # For curl commands
   # Replace your-render-service with actual URL
   ```

---

## 🧪 TEST 1: Super Admin WITH 2FA (3 minutes)

**Purpose:** Verify 2FA screen appears and code validation works

### Test Steps:

1. **Logout completely:**
   - Clear browser cache/cookies
   - DevTools → Application → Clear all storage

2. **Go to production login:**
   - Navigate to: https://yourdomain.com/admin/login

3. **Click "Sign in with Google":**
   - Login with super_admin account (2FA enabled)
   - Expected: OAuth popup and redirect

4. **Verify 2FA screen appears:**
   - ✅ Should show "Enter 6-digit code from authenticator"
   - ✅ Code input field visible
   - ✅ "Verify" button visible
   - ✅ No console errors (F12)

5. **Enter 6-digit code:**
   - Get code from authenticator app
   - Paste into input field
   - ✅ Should auto-submit when 6 digits entered

6. **Verify code accepted:**
   - ✅ No error messages
   - ✅ "Verifying..." spinner appears briefly
   - ✅ Redirects to dashboard
   - ✅ Dashboard loads

7. **Verify audit logs:**
   ```sql
   SELECT action, status FROM admin_audit_logs 
   WHERE created_at > now() - interval '2 min'
   ORDER BY created_at DESC LIMIT 5;
   
   -- Expected to see:
   -- 2FA_VERIFY_ATTEMPT | success
   -- LOGIN_SUCCESS | success
   ```

### Expected Results:

| Signal | Result | Status |
|--------|--------|--------|
| 2FA screen appears | Yes | ✅ |
| Code input works | Yes | ✅ |
| Auto-submit at 6 digits | Yes | ✅ |
| Code accepted | Yes | ✅ |
| Redirects to dashboard | Yes | ✅ |
| No console errors | Clean | ✅ |
| Audit log shows success | Yes | ✅ |

### If Test Fails:

**Failure: 2FA screen doesn't appear**
- Check: `SELECT twofa_enabled FROM admin_users WHERE email='super@...'`
- Expected: `true`
- If false: 2FA not enabled for this user

**Failure: "Invalid code" on correct code**
- Check: Is there a time sync issue with authenticator?
- Try: Same code again (sometimes off by 1 step)
- Render logs: Should show `2FA_VERIFY_ATTEMPT failure`

**Failure: 401 error**
- Check: Is JWT token valid?
- Check: Render logs for `[AUTH]` errors
- Action: Clear cache, try again

**GO:** ✅ If 2FA verification works  
**NO-GO:** ❌ If 2FA screen doesn't appear or code rejected

---

## 🧪 TEST 2: Super Admin WITHOUT 2FA (2 minutes)

**Purpose:** Verify super_admin without 2FA can still login

### Test Steps:

1. **Logout completely:**
   - Clear storage again

2. **Go to login:**
   - Navigate to: https://yourdomain.com/admin/login

3. **Sign in with super_admin (NO 2FA enabled):**
   - Click "Sign in with Google"
   - Use different super_admin account or user without 2FA

4. **Verify NO 2FA screen:**
   - ✅ OAuth completes
   - ✅ **NO 2FA screen shown**
   - ✅ Direct redirect to dashboard
   - ✅ Dashboard loads
   - ✅ No console errors

5. **Verify audit logs:**
   ```sql
   SELECT action, status FROM admin_audit_logs 
   WHERE created_at > now() - interval '2 min'
   AND action LIKE 'LOGIN%'
   ORDER BY created_at DESC LIMIT 3;
   
   -- Expected to see:
   -- LOGIN_SUCCESS | success
   -- NO 2FA entries
   ```

### Expected Results:

| Signal | Result | Status |
|--------|--------|--------|
| No 2FA screen | Yes | ✅ |
| Direct dashboard | Yes | ✅ |
| Dashboard loads | Yes | ✅ |
| No console errors | Clean | ✅ |
| Audit log: LOGIN_SUCCESS | Yes | ✅ |

### If Test Fails:

**Failure: 2FA screen appears (shouldn't)**
- Check: Database has `twofa_enabled = false` for this user
- Render logs: Should show `[2FA] 2FA not enabled, allowing...`

**Failure: Cannot login**
- Check: Is user a super_admin?
- Check: Is JWT valid?
- Action: Check Render logs for auth errors

**GO:** ✅ If super_admin without 2FA logs in directly  
**NO-GO:** ❌ If 2FA screen appears (should NOT)

---

## 🧪 TEST 3: Moderator/Analyst (1 minute)

**Purpose:** Verify non-super-admins bypass 2FA

### Test Steps:

1. **Logout completely**

2. **Go to login:**
   - Navigate to: https://yourdomain.com/admin/login

3. **Sign in with moderator/analyst:**
   - Click "Sign in with Google"
   - Use moderator or analyst account

4. **Verify NO 2FA:**
   - ✅ OAuth completes
   - ✅ **NO 2FA screen**
   - ✅ Redirects to dashboard
   - ✅ Can access /admin routes

5. **Verify they can't access super_admin routes:**
   - Try: `curl -H "Authorization: Bearer $TOKEN" https://...:3000/admin/audit-logs`
   - Expected: 403 Forbidden (due to requireSuperAdmin check)
   - NOT 401 (which would be 2FA issue)

### Expected Results:

| Signal | Result | Status |
|--------|--------|--------|
| No 2FA screen | Yes | ✅ |
| Dashboard loads | Yes | ✅ |
| Can access normal routes | Yes | ✅ |
| 403 on super_admin routes | Yes | ✅ |
| No 401 (2FA error) | Yes | ✅ |

### If Test Fails:

**Failure: 2FA screen appears (shouldn't)**
- Render logs: Should show `[2FA] Non-super-admin, bypassing 2FA`
- If not: Middleware order might be wrong

**GO:** ✅ If non-admins bypass correctly  
**NO-GO:** ❌ If 2FA screen appears (should NOT)

---

## 🧪 TEST 4: Rate Limiting (5 minutes)

**Purpose:** Verify 3-attempt lockout works in production

### Test Steps:

1. **Logout completely**

2. **Go to login:**
   - Navigate to: https://yourdomain.com/admin/login

3. **Sign in with super_admin WITH 2FA:**
   - Click "Sign in with Google"
   - 2FA screen appears

4. **Enter WRONG code 3 times:**
   - Attempt 1: Type `000000` → Error "Invalid code, 2 attempts remaining"
   - Attempt 2: Type `111111` → Error "Invalid code, 1 attempt remaining"
   - Attempt 3: Type `222222` → Error "Too many attempts, try again in 600 seconds"

5. **Verify lockout:**
   - ✅ Input becomes disabled/readonly
   - ✅ Cannot enter more codes
   - ✅ Timer shows ~600 seconds remaining

6. **Check database:**
   ```sql
   SELECT admin_id, attempt_count, locked_until 
   FROM twofa_attempts
   WHERE updated_at > now() - interval '5 min'
   ORDER BY updated_at DESC LIMIT 1;
   
   -- Expected:
   -- attempt_count = 3
   -- locked_until = future timestamp (now + 10 min)
   ```

7. **Check audit logs:**
   ```sql
   SELECT action, status FROM admin_audit_logs
   WHERE created_at > now() - interval '5 min'
   AND action LIKE '2FA%'
   ORDER BY created_at DESC LIMIT 10;
   
   -- Expected to see:
   -- 2FA_VERIFY_ATTEMPT | failure (3x)
   -- 2FA_LOCKOUT | success (1x)
   ```

8. **Verify Render logs:**
   - Should see: `[2FA] Rate limit exceeded`
   - Should see: `[RATE_LIMIT] Admin locked out for 10 minutes`

### Expected Results:

| Signal | Result | Status |
|--------|--------|--------|
| Attempt 1 counted | Yes | ✅ |
| Attempt 2 counted | Yes | ✅ |
| Attempt 3 locked | Yes | ✅ |
| DB shows 3 attempts | Yes | ✅ |
| DB shows locked_until | Yes | ✅ |
| Audit log: 3x failures | Yes | ✅ |
| Audit log: 1x lockout | Yes | ✅ |

### If Test Fails:

**Failure: Lockout doesn't trigger after 3 attempts**
- Check: Rate limiter middleware in place
- Check: Render logs for `[RATE_LIMIT]` messages
- Check: twofa_attempts table exists in DB

**Failure: Lockout duration wrong (not 10 min)**
- Check: src/services/supabase.ts line ~320
- Should be: `locked_until = now() + 10 minutes`

**GO:** ✅ If rate limiting works correctly  
**NO-GO:** ❌ If more than 3 attempts allowed

---

## 🧪 TEST 5: Access Protected Route with 2FA (2 minutes)

**Purpose:** Verify middleware allows access after 2FA verification

### Test Steps:

1. **Login as super_admin with 2FA:**
   - Complete login flow
   - Enter valid 2FA code
   - Reach dashboard

2. **Try accessing /admin/audit-logs:**
   - Option A: Navigate to audit logs page (if UI exists)
   - Option B: Use curl:
     ```bash
     curl -H "Authorization: Bearer $TOKEN" https://your-render.onrender.com/api/admin/audit-logs
     
     # Expected response:
     # { "logs": [...], "total": N }
     # HTTP 200 OK
     ```

3. **Verify success:**
   - ✅ Audit logs display/return data
   - ✅ No 401 error
   - ✅ No permission error

4. **Check Render logs:**
   - Should see: `[2FA] 2FA verified, allowing access`
   - Or: `[MIDDLEWARE] require2FA passing`

### Expected Results:

| Signal | Result | Status |
|--------|--------|--------|
| Can access /audit-logs | Yes | ✅ |
| No 401 error | Yes | ✅ |
| No permission error | Yes | ✅ |
| Data returned | Yes | ✅ |

### If Test Fails:

**Failure: 401 Unauthorized**
- Middleware might not be recognizing verified status
- Check: Render logs for `[2FA] verification failed`

**Failure: 403 Forbidden**
- User might not be super_admin
- Check: User role in database

**GO:** ✅ If verified users can access routes  
**NO-GO:** ❌ If 401 or 403 errors persist

---

## 📊 SUMMARY TABLE

| Test | Expected | Actual | Pass |
|------|----------|--------|------|
| **Test 1: Super Admin WITH 2FA** | 2FA screen, code verified | | |
| **Test 2: Super Admin NO 2FA** | No screen, direct login | | |
| **Test 3: Moderator/Analyst** | No 2FA, bypass successful | | |
| **Test 4: Rate Limiting** | 3 attempts, 10-min lockout | | |
| **Test 5: Protected Route Access** | Can access after 2FA | | |

---

## 🎯 GO/NO-GO DECISION

### GO Criteria (All 5 Tests Pass):

```
[ ] Test 1: Super admin with 2FA can login
[ ] Test 2: Super admin without 2FA can login
[ ] Test 3: Non-admin bypasses 2FA correctly
[ ] Test 4: Rate limiting locks after 3 attempts
[ ] Test 5: Protected routes accessible after 2FA
[ ] No console errors in any test
[ ] No Render errors in logs
[ ] All audit logs show expected entries
[ ] All database entries correct
```

### NO-GO Signals (Immediate Action):

```
[ ] 2FA screen doesn't appear for super_admin with 2FA
[ ] 2FA screen appears for non-super-admin
[ ] Rate limiting doesn't work
[ ] Locked users can still retry immediately
[ ] 401 errors on valid requests
[ ] Render logs show errors
[ ] Database connection failed
[ ] Middleware bypassed
```

---

## 🎬 NEXT STEPS

### If ALL Tests Pass: ✅

1. **Proceed to Monitoring:**
   - Open PHASE_3_MONITORING_PLAN.md
   - Start 24-hour burn-in monitoring
   - Watch for errors in production

### If ANY Test Fails: ❌

1. **Immediate Action:**
   - Open PHASE_3_EMERGENCY_DISABLE.md
   - Execute rollback for failed component
   - Investigate root cause

2. **Common Fixes:**
   - 2FA not appearing: Check `twofa_enabled` in database
   - 2FA too strict: Check middleware order
   - Rate limiting broken: Check twofa_attempts table
   - Access denied: Check JWT/role verification

---

## 📞 QUICK REFERENCE

**Render Logs:** Service → Logs tab (live updates)  
**Database:** Supabase → SQL Editor  
**Frontend:** DevTools → Console (F12)  
**Curl test:** `curl https://service-url/health`  

**When something fails:** Look in Render logs first (usually has the error message)

---

**PRINT THIS CHECKLIST. Use it during verification.**

**✅ All tests pass?** → Go to PHASE_3_MONITORING_PLAN.md  
**❌ Any test fails?** → Go to PHASE_3_EMERGENCY_DISABLE.md

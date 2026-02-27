# ✅ POST-ACTIVATION SMOKE TEST (5 Minutes)

**Run immediately after:** Attaching require2FA middleware  
**Expected Duration:** 5 minutes  
**Success Criteria:** All 4 tests pass with no errors  

---

## 📋 QUICK CHECKLIST (Copy & Paste)

```
POST-ACTIVATION SMOKE TEST
Date: ________________
Status: ________________

COMPILATION:
  [ ] npm run build completed
  [ ] No TypeScript errors
  [ ] Backend starts without errors

AUTHENTICATION:
  [ ] Super admin without 2FA logs in (no 2FA screen)
  [ ] Super admin with 2FA sees verification screen
  [ ] Enters valid code and completes login
  [ ] Non-super-admin bypasses 2FA

FUNCTIONALITY:
  [ ] Can access audit logs
  [ ] Can access login history
  [ ] Dashboard loads
  [ ] No console errors

DATABASE:
  [ ] Audit logs showing expected entries
  [ ] No error entries
  [ ] twofa_attempts table updated correctly

RESULT: ______ PASS / FAIL
```

---

## 🧪 TEST 1: Compilation (30 seconds)

**What:** Verify code compiles after adding middleware

**Steps:**
```bash
# Terminal 1
cd d:\Dream project\Return\backend\nodejs
npm run build
```

**Expected Output:**
```
> trust-backend@1.0.0 build
> tsc

(no output after tsc = success)
```

**Success Criteria:**
- ✅ Command completes
- ✅ No "error TS" messages
- ✅ No "SyntaxError" messages
- Exit code: 0

**If Fails:**
- ❌ Exit code: 1 or higher
- ❌ Error messages shown
- → Go to "Rollback" section

---

## 🧪 TEST 2: Server Startup (1 minute)

**What:** Verify backend starts with middleware loaded

**Steps:**
```bash
# Terminal 1 - Stop previous server (Ctrl+C)
# Then:
cd d:\Dream project\Return\backend\nodejs
npm run dev
```

**Expected Output:**
```
Server running on port 3000
[AUTH] Middleware initialized
[2FA] Service ready
(No error messages)
```

**Success Criteria:**
- ✅ Server starts on port 3000
- ✅ No "error" messages in console
- ✅ No connection errors to database
- ✅ No middleware loading errors

**If Fails:**
- ❌ Port 3000 already in use → Kill process or use different port
- ❌ Database connection error → Check .env file
- ❌ Middleware loading error → Check imports
- → Go to "Rollback" section

---

## 🧪 TEST 3: Super Admin WITHOUT 2FA (1 minute)

**What:** Verify super_admin without 2FA can login without 2FA screen

**Setup:**
```bash
# Terminal 2 - Keep backend running
# Open browser and verify:
# - Backend running on localhost:3000
# - Frontend running on localhost:5174
```

**Steps:**
1. Clear browser storage:
   - Press F12 → Application → Local Storage
   - Delete all keys
   - Close DevTools

2. Navigate to login page:
   - Go to `http://localhost:5174/admin/login`

3. Login:
   - Click "Sign in with Google"
   - Choose test-super@example.com (WITHOUT 2FA)

4. Verify flow:
   - ✅ Google popup appears
   - ✅ Redirect back to app
   - ✅ **NO 2FA verification screen**
   - ✅ Redirects to `/admin`
   - ✅ Dashboard loads

**Success Criteria:**
- ✅ No 2FA screen shown
- ✅ Dashboard accessible
- ✅ No 401/403 errors
- ✅ Console clean (no errors)

**If Fails:**
```javascript
// In Console, check:
console.log(localStorage.getItem('requires2fa'));  // Should be null or false
console.log(localStorage.getItem('user'));  // Should have user object
```

**Failure Signals:**
- ❌ 2FA screen shown (middleware broken)
- ❌ 403 error (middleware too strict)
- ❌ Infinite loading spinner
- ❌ Console errors about "require2FA"
- → Go to "Rollback" section

---

## 🧪 TEST 4: Super Admin WITH 2FA (2 minutes)

**What:** Verify super_admin with 2FA sees verification screen

**Setup:**
```bash
# Using same browser/tab from Test 3
# But test with 2FA-enabled account
```

**Steps:**
1. Clear browser storage again:
   - F12 → Application → Local Storage → Delete all

2. Navigate to login:
   - Go to `http://localhost:5174/admin/login`

3. Login:
   - Click "Sign in with Google"
   - Choose test-super@example.com (WITH 2FA enabled)

4. Verify 2FA screen:
   - ✅ OAuth completes
   - ✅ **2FA verification screen appears**
   - ✅ Shows "Enter 6-digit code"
   - ✅ Code input field visible
   - ✅ "Verify" button visible

5. Enter code:
   - Open authenticator app
   - Get 6-digit code
   - Paste into input field
   - ✅ Auto-submits or click Verify

6. Verify success:
   - ✅ "Verifying..." shows briefly
   - ✅ Redirects to `/admin`
   - ✅ Dashboard loads

**Success Criteria:**
- ✅ 2FA screen shown
- ✅ Code accepted on first try
- ✅ Redirects to dashboard
- ✅ No error messages
- ✅ Console clean

**If Fails:**
```javascript
// In Console during 2FA screen:
console.log(localStorage.getItem('requires2fa'));  // Should be 'true'
```

**Failure Signals:**
- ❌ 2FA screen NOT shown (should be shown)
- ❌ "Invalid code" for correct code (DB issue)
- ❌ 401 error (middleware blocking)
- ❌ Stuck on verification screen
- ❌ Auto-submit not working
- → Go to "Rollback" section

---

## 🧪 TEST 5: Non-Super-Admin Bypass (1 minute)

**What:** Verify non-super-admin doesn't see 2FA

**Steps:**
1. Clear browser storage again

2. Navigate to login:
   - Go to `http://localhost:5174/admin/login`

3. Login as moderator:
   - Click "Sign in with Google"
   - Choose moderator@example.com (or analyst account)

4. Verify bypass:
   - ✅ OAuth completes
   - ✅ **NO 2FA screen**
   - ✅ Redirects to dashboard
   - ✅ Dashboard loads

**Success Criteria:**
- ✅ No 2FA screen shown
- ✅ Direct dashboard access
- ✅ No 401 errors
- ✅ Console clean

**If Fails:**
- ❌ 2FA screen shown (middleware broken)
- ❌ 403 error (permission issue)
- → Go to "Rollback" section

---

## 🧪 TEST 6: Database Verification (1 minute)

**What:** Verify audit logs and attempts table have correct entries

**Steps:**

1. Connect to Supabase SQL editor

2. Check audit logs:
```sql
SELECT 
  id,
  admin_id,
  action,
  status,
  timestamp
FROM admin_audit_logs
WHERE created_at > now() - interval '10 minutes'
ORDER BY timestamp DESC
LIMIT 20;
```

**Expected Results:**
- ✅ LOGIN_SUCCESS entries for all tests
- ✅ 2FA_VERIFY_ATTEMPT (success) if tested with 2FA
- ✅ NO error entries
- ✅ Timestamps recent (last 10 minutes)

**Example Expected Output:**
```
id        | admin_id | action                | status   | timestamp
----------|----------|----------------------|----------|------------------
...       | abc123   | LOGIN_SUCCESS        | success  | 2026-01-08 10:30
...       | abc123   | 2FA_VERIFY_ATTEMPT    | success  | 2026-01-08 10:29
...       | abc456   | LOGIN_SUCCESS        | success  | 2026-01-08 10:25
```

3. Check twofa_attempts:
```sql
SELECT 
  admin_id,
  attempt_count,
  locked_until,
  updated_at
FROM twofa_attempts
WHERE updated_at > now() - interval '10 minutes'
ORDER BY updated_at DESC;
```

**Expected Results:**
- ✅ Should be empty or have attempt_count=0 (after reset)
- ✅ locked_until should be NULL
- ✅ Recent timestamps only

**Success Criteria:**
- ✅ Audit logs clean
- ✅ No error entries
- ✅ Correct actions recorded
- ✅ Attempt counts accurate

**If Fails:**
- ❌ No audit log entries (logging broken)
- ❌ Error entries (unexpected failures)
- ❌ Locked status stuck (need to reset)
- → Query: `UPDATE twofa_attempts SET attempt_count=0, locked_until=NULL;`

---

## 🧪 TEST 7: No Breaking Changes (1 minute)

**What:** Verify existing functionality still works

**Steps:**

1. Access admin analytics:
   - Go to `http://localhost:5174/admin` (as super_admin)
   - Click "Analytics"
   - ✅ Dashboard loads
   - ✅ Data shows

2. Check logs access:
   - Navigate to any admin page
   - ✅ Loads without issues
   - ✅ No permission errors

3. Check console:
   ```javascript
   // In Console:
   // Should be clean, no errors
   ```

**Success Criteria:**
- ✅ All admin pages still work
- ✅ No 401/403 on expected routes
- ✅ No infinite loading states
- ✅ Console clean

**If Fails:**
- ❌ Pages broken (middleware too strict)
- ❌ 401 on non-protected routes (middleware leaking)
- → Go to "Rollback" section

---

## 📊 FINAL RESULTS SUMMARY

Fill this out and save:

```
SMOKE TEST RESULTS
==================
Date: ________________
Tester: ________________

Test 1 (Compilation):     [ ] PASS [ ] FAIL
Test 2 (Server Start):    [ ] PASS [ ] FAIL
Test 3 (No 2FA Login):    [ ] PASS [ ] FAIL
Test 4 (With 2FA Login):  [ ] PASS [ ] FAIL
Test 5 (Non-Admin):       [ ] PASS [ ] FAIL
Test 6 (DB Logs):         [ ] PASS [ ] FAIL
Test 7 (No Breaking):     [ ] PASS [ ] FAIL

Overall Result: [ ] ALL PASS [ ] SOME FAILURES

If failures:
- Note failed tests: _______________________
- Error messages: _______________________
- Action taken: _______________________
```

---

## 🚨 IF ANY TEST FAILS

### Immediate Action:
1. **STOP** - Do not proceed to production
2. **Note** the failing test number
3. **Check** the rollback section below
4. **Rollback** to pre-middleware state

### Common Failures & Quick Fixes:

**Failure: 2FA screen not showing for super_admin with 2FA**
```javascript
// Check in Console:
fetch('/api/admin/auth/profile')
  .then(r => r.json())
  .then(d => console.log('2FA required?', d.requires_2fa));
// If false, check database: SELECT twofa_enabled FROM admin_users WHERE email='...';
```

**Failure: All logins returning 401**
```bash
# Likely cause: require2FA middleware being too strict
# Fix: Remove require2FA from routes and recompile
# See Rollback section
```

**Failure: Audit logs not appearing**
```sql
-- Check if logging is working:
SELECT COUNT(*) FROM admin_audit_logs WHERE created_at > now() - interval '1 hour';
-- If 0, logging is broken. Check logAdminAction calls.
```

**Failure: Database errors**
```sql
-- Verify twofa tables exist:
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'twofa%';
-- Should return: twofa_attempts
```

---

## 🔄 ROLLBACK (If Smoke Test Fails)

### Quick Rollback (2 minutes):

**Option 1: Remove middleware from routes**
```bash
# 1. Edit: backend/nodejs/src/routes/admin.routes.ts
# 2. Delete the require2FA, lines you added
# 3. Keep the import (won't hurt)
# 4. npm run build
# 5. Restart server
```

**Option 2: Full code rollback**
```bash
cd d:\Dream project\Return
git diff HEAD  # See what changed
git checkout backend/nodejs/src/routes/admin.routes.ts  # Revert file
npm run build
npm run dev
```

**Option 3: Git reset**
```bash
cd d:\Dream project\Return
git reset --hard HEAD  # Go back to last commit
npm run build
npm run dev
```

### Database Rollback:

```sql
-- If users are locked out:
UPDATE twofa_attempts 
SET attempt_count=0, locked_until=NULL;

-- If 2FA is blocking everyone:
UPDATE admin_users SET twofa_enabled=false WHERE role='super_admin';
```

---

## ✅ SIGN-OFF

**All tests passed?**

- [ ] YES → Ready for production deployment
- [ ] NO → Review failures, rollback, and investigate

**Next Steps if All Pass:**
1. Commit changes to git
2. Push to Render (or your deployment)
3. Verify deployment successful
4. Monitor logs for 24 hours
5. Celebrate! 🎉

---

**Questions or Issues?** Check PHASE_3_QA_TESTING_GUIDE.md for detailed testing procedures.

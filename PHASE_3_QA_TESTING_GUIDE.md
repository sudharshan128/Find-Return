# 🧪 PHASE 3 QA TESTING GUIDE: Super Admin 2FA Activation

**Status:** Pre-Activation Testing  
**Duration:** ~15-20 minutes for all 4 tests  
**Risk Level:** 🟢 ZERO (Testing non-enforced code)  

---

## 📋 PREREQUISITES BEFORE STARTING

### ✅ Verify Setup:
```bash
# 1. Backend compiled
cd d:\Dream project\Return\backend\nodejs
npm run build  # Should complete with no errors

# 2. Database migration applied
# Check Supabase: admin_users table should have:
#   - twofa_enabled (boolean)
#   - twofa_secret (text)
#   - twofa_verified_at (timestamp)
#   - twofa_backup_codes (text array)

# 3. Environment variables configured
# Verify .env has: VITE_BACKEND_URL, SUPABASE_URL, SUPABASE_KEY
```

---

## 🚀 START LOCAL SERVERS

### Terminal 1: Start Backend
```bash
cd d:\Dream project\Return\backend\nodejs
npm run dev
# Expected output:
# Server running on port 3000
# [AUTH] Database connected
# [2FA] Service initialized
```

### Terminal 2: Start Frontend
```bash
cd d:\Dream project\Return\frontend
npm run dev
# Expected output:
# Local: http://localhost:5174
```

### Terminal 3: Database Queries (Keep open)
```bash
# You'll use this to check database state during tests
# Connect to Supabase via SQL editor or client
```

---

## 🧪 TEST SCENARIO 1: Super Admin WITHOUT 2FA Enabled

**Purpose:** Verify super_admin can login WITHOUT seeing 2FA screen if not enabled

### SETUP:
1. Open Supabase SQL editor
2. Run query to check test admin:
```sql
SELECT id, email, role, twofa_enabled, twofa_verified_at 
FROM admin_users 
WHERE email = 'test-super@example.com';
```
3. **Expected:** Returns one row with `twofa_enabled = false`

### MANUAL TEST STEPS:

**Step 1: Clear Local State**
- Open browser DevTools (F12)
- Application tab → Local Storage
- Delete these keys if they exist:
  - `supabase.auth.token`
  - `requires2fa`
  - Any `session_*` keys
- Clear cookies (Supabase session)

**Step 2: Login**
- Navigate to `http://localhost:5174/admin/login`
- Click "Sign in with Google"
- Login with test Google account (test-super@example.com)

**Step 3: Verify Flow**
- ✅ OAuth popup appears and completes
- ✅ Redirects to callback page
- ✅ **NO 2FA verification screen shown**
- ✅ Redirects to `/admin` dashboard
- ✅ Dashboard loads (you see admin panel)

**Step 4: Check Browser Logs**
- DevTools Console → No errors
- Check for messages like:
  ```
  [AuthCallback] Checking 2FA requirement...
  [AuthCallback] 2FA not required, redirecting to dashboard
  ```

**Step 5: Check Database Audit Log**
```sql
SELECT id, admin_id, action, status, timestamp 
FROM admin_audit_logs 
WHERE action LIKE 'LOGIN%' 
ORDER BY timestamp DESC 
LIMIT 5;
```
- ✅ Should show `LOGIN_SUCCESS` for this admin
- ✅ NO `2FA_REQUIRED` entries

### ❌ FAIL CONDITIONS (STOP if any occur):
- [ ] 2FA screen shows (should NOT show)
- [ ] 401 error on login
- [ ] Console errors about "requires2fa"
- [ ] Dashboard fails to load
- [ ] Database errors in audit log

### ✅ SUCCESS: Move to Test 2

---

## 🧪 TEST SCENARIO 2: Super Admin WITH 2FA Enabled

**Purpose:** Verify super_admin WITH 2FA sees verification screen and can verify

### SETUP:

**Option A: Enable via UI (Recommended)**
1. From Test 1, you should be logged in
2. Navigate to `/admin/2fa-setup`
3. Click "Enable 2FA"
4. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
5. Copy 6-digit code from app
6. Paste code into verification field
7. Click "Verify"
8. ✅ Should show "2FA Enabled Successfully"

**Option B: Enable via Database (If UI fails)**
```sql
UPDATE admin_users 
SET 
  twofa_enabled = true,
  twofa_secret = 'JBSWY3DPEBLW64TMMQ======',  -- Dummy encrypted secret
  twofa_verified_at = now()
WHERE email = 'test-super@example.com';
```

### VERIFY SETUP:
```sql
SELECT id, email, twofa_enabled, twofa_verified_at 
FROM admin_users 
WHERE email = 'test-super@example.com';
```
- ✅ `twofa_enabled = true`
- ✅ `twofa_verified_at` has a timestamp
- ✅ `twofa_secret` has encrypted data

### MANUAL TEST STEPS:

**Step 1: Clear Session**
- Clear Local Storage keys (same as Test 1)
- Close tab and clear cookies completely

**Step 2: Login Fresh**
- Navigate to `http://localhost:5174/admin/login`
- Click "Sign in with Google"
- Login with same test account

**Step 3: Verify 2FA Screen Appears**
- ✅ OAuth completes
- ✅ **2FA Verification screen shown** with:
  - "Enter 6-digit code from authenticator"
  - Code input field
  - "Verify" button
  - "Cancel & Sign Out" option

**Step 4: Enter Valid Code**
- Open authenticator app
- Get 6-digit code for this account
- Type/paste into 2FA input field
- ✅ Auto-submits when 6 digits entered (or click Verify)

**Step 5: Verify Success Flow**
- ✅ Code accepted (no error message)
- ✅ "Verifying..." spinner shows briefly
- ✅ Redirects to `/admin` dashboard
- ✅ Dashboard loads successfully

**Step 6: Check Browser Logs**
- DevTools Console → No errors
- Look for messages:
  ```
  [TwoFAVerification] Code accepted
  [AuthCallback] 2FA verified, proceeding to dashboard
  ```

**Step 7: Check Database Audit Log**
```sql
SELECT id, admin_id, action, metadata, status, timestamp 
FROM admin_audit_logs 
WHERE action LIKE '2FA%' 
ORDER BY timestamp DESC 
LIMIT 5;
```
- ✅ Should show `2FA_VERIFY_ATTEMPT` with `status = 'success'`
- ✅ Should show `LOGIN_SUCCESS` after 2FA

### ❌ FAIL CONDITIONS (STOP if any occur):
- [ ] 2FA screen doesn't show (should show)
- [ ] Code field doesn't accept digits
- [ ] Auto-submit doesn't work at 6 digits
- [ ] Invalid code rejected with "Try again" (should only show if wrong code)
- [ ] 401 error on verification
- [ ] Audit logs don't show 2FA attempt
- [ ] Stuck on 2FA screen (spinner never clears)

### ✅ SUCCESS: Move to Test 3

---

## 🧪 TEST SCENARIO 3: Moderator/Analyst (Non-Super-Admin)

**Purpose:** Verify non-super-admins never see 2FA screen

### SETUP:

**Check Moderator Account Exists:**
```sql
SELECT id, email, role, twofa_enabled 
FROM admin_users 
WHERE role = 'moderator' OR role = 'analyst'
LIMIT 1;
```
- ✅ Should return at least one moderator/analyst
- Note their email address

### MANUAL TEST STEPS:

**Step 1: Clear Session**
- Clear Local Storage and cookies (same as before)

**Step 2: Login as Non-Super-Admin**
- Navigate to `http://localhost:5174/admin/login`
- Click "Sign in with Google"
- Login with moderator/analyst email

**Step 3: Verify NO 2FA Screen**
- ✅ OAuth completes
- ✅ **NO 2FA verification screen appears**
- ✅ Directly redirects to `/admin` dashboard
- ✅ Dashboard loads successfully

**Step 4: Check Backend Logic (DevTools)**
```javascript
// In Console, check what happened:
console.log(localStorage.getItem('requires2fa'));  // Should be null or 'false'
```

**Step 5: Verify Database Logs**
```sql
SELECT admin_id, email, action, status, timestamp 
FROM admin_audit_logs 
JOIN admin_users ON admin_audit_logs.admin_id = admin_users.id
WHERE admin_users.role IN ('moderator', 'analyst')
AND action LIKE 'LOGIN%'
ORDER BY timestamp DESC 
LIMIT 5;
```
- ✅ Should show `LOGIN_SUCCESS` for this user
- ✅ NO `2FA_REQUIRED` entries
- ✅ NO `2FA_VERIFY_ATTEMPT` entries

### ❌ FAIL CONDITIONS (STOP if any occur):
- [ ] 2FA screen shows (should NEVER show)
- [ ] Non-admin can't access dashboard
- [ ] 401 error
- [ ] Audit logs show 2FA events (should NOT)

### ✅ SUCCESS: Move to Test 4

---

## 🧪 TEST SCENARIO 4: Rate Limiting (3 Strikes)

**Purpose:** Verify rate limiting works: 3 wrong codes → 10-minute lockout

### SETUP:

**Use Super Admin WITH 2FA from Test 2**
- Same account from Test 2 (test-super@example.com)
- Must have `twofa_enabled = true`

### MANUAL TEST STEPS:

**Step 1: Clear Session & Login Fresh**
- Clear Local Storage/cookies
- Login as super_admin with 2FA
- 2FA screen appears

**Step 2: Enter WRONG Code (Attempt 1)**
- Type random 6 digits (e.g., `000000`)
- ✅ Error appears: "Invalid code, 2 attempts remaining"
- ✅ Code input clears
- ✅ Error disappears after 5 seconds

**Step 3: Enter WRONG Code (Attempt 2)**
- Type different random 6 digits (e.g., `111111`)
- ✅ Error appears: "Invalid code, 1 attempt remaining"
- ✅ Code input clears

**Step 4: Enter WRONG Code (Attempt 3)**
- Type different random 6 digits (e.g., `222222`)
- ✅ Error appears: **"Too many failed attempts. Try again in 600 seconds"**
- ✅ Code input becomes disabled/readonly
- ✅ Cannot enter more codes

**Step 5: Verify Lockout Duration**
- Note timestamp
- Wait 30 seconds (or manually check database)
- ✅ Screen should still show lockout message
- ✅ ~570 seconds remaining in error message

**Step 6: Check Database - Attempt Log**
```sql
SELECT * FROM twofa_attempts 
WHERE admin_id = (SELECT id FROM admin_users WHERE email = 'test-super@example.com')
ORDER BY updated_at DESC 
LIMIT 1;
```
- ✅ `attempt_count = 3`
- ✅ `locked_until` is in the future (~10 minutes from now)

**Step 7: Check Audit Log**
```sql
SELECT id, action, metadata, status, timestamp 
FROM admin_audit_logs 
WHERE admin_id = (SELECT id FROM admin_users WHERE email = 'test-super@example.com')
AND action LIKE '2FA%'
ORDER BY timestamp DESC 
LIMIT 10;
```
- ✅ Should show 3x `2FA_VERIFY_ATTEMPT` with `status = 'failure'`
- ✅ Should show 1x `2FA_LOCKOUT` with metadata showing attempt count

**Step 8: Clear Lockout (Optional - for testing purposes)**
```sql
UPDATE twofa_attempts 
SET attempt_count = 0, locked_until = NULL 
WHERE admin_id = (SELECT id FROM admin_users WHERE email = 'test-super@example.com');
```

### ❌ FAIL CONDITIONS (STOP if any occur):
- [ ] Wrong code shows generic error (should show "Invalid code")
- [ ] No attempt count shown ("2 attempts remaining")
- [ ] Doesn't lock after 3 attempts
- [ ] Lockout duration is wrong (not 10 min/600 sec)
- [ ] Audit logs don't show attempts/lockout
- [ ] Can still enter code while locked

### ✅ SUCCESS: All Tests Passed!

---

## ✅ POST-TEST VERIFICATION

If all 4 tests pass, run these final checks:

### Database Sanity Check:
```sql
-- 1. Verify twofa_attempts table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'twofa_attempts';
-- Expected: 1 row

-- 2. Verify admin_users has 2FA columns
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'admin_users' 
AND column_name LIKE 'twofa%';
-- Expected: 4 rows (twofa_enabled, twofa_secret, twofa_verified_at, twofa_backup_codes)

-- 3. Check audit logs are recording
SELECT COUNT(*) as audit_count FROM admin_audit_logs 
WHERE created_at > now() - interval '1 hour';
-- Expected: > 5 (should have entries from tests)

-- 4. Verify no errors in recent logs
SELECT status, COUNT(*) 
FROM admin_audit_logs 
WHERE created_at > now() - interval '1 hour'
GROUP BY status;
-- Expected: Mostly 'success', some 'failure' (expected from rate limit test)
```

### Application Health:
```bash
# Backend health endpoint
curl http://localhost:3000/health
# Expected: { status: "ok", timestamp: "...", version: "..." }

# Check no TypeScript errors
cd d:\Dream project\Return\backend\nodejs
npm run build
# Expected: No errors

# Check frontend builds
cd d:\Dream project\Return\frontend
npm run build
# Expected: Build successful
```

---

## 📊 EXPECTED TEST RESULTS SUMMARY

| Test | Pass Condition | Database Signal | UI Signal |
|---|---|---|---|
| **Test 1** | No 2FA screen | LOGIN_SUCCESS only | Direct to dashboard |
| **Test 2** | 2FA screen + code works | 2FA_VERIFY_ATTEMPT (success) | Redirects to dashboard |
| **Test 3** | No 2FA screen | LOGIN_SUCCESS only | Direct to dashboard |
| **Test 4** | 3 strikes locks | 3x (failure) + 1x LOCKOUT | "Try again in 600 seconds" |

---

## ⏭️ NEXT STEPS (After All Tests Pass)

1. ✅ All tests passed → Ready to attach middleware
2. Run EXACT code change (see next section)
3. Recompile backend
4. Run post-activation smoke tests
5. Deploy to Render
6. Monitor for 24 hours

---

**When ready to proceed with middleware activation, confirm all 4 tests passed!**

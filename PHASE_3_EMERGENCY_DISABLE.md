# 🚨 PHASE 3 PRODUCTION: Emergency Disable & Rollback

**When to use:** Only if 2FA is causing production issues  
**Speed:** Under 5 minutes to disable  
**Reversibility:** Can restore 2FA anytime after  

---

## ⚠️ WHEN TO EMERGENCY DISABLE

### Disable Immediately (No Deliberation):

```
❌ Service crashes when 2FA enabled (502 errors)
❌ Database connection fails after 2FA deployment
❌ All logins failing (100% failure rate)
❌ Security breach or token compromise
❌ Unplanned extended downtime
```

### Disable Within 15 Minutes (With Investigation):

```
⚠️ 2FA verification fails for >50% of users
⚠️ Rate limiting too aggressive (>10 lockouts/hour)
⚠️ Auth tokens being rejected unexpectedly
⚠️ Multiple users locked out simultaneously
⚠️ Render service unstable/crashing repeatedly
```

### Monitor (Do Not Disable):

```
ℹ️ 1-2 users locked out after wrong attempts (normal)
ℹ️ 1-2 auth failures (normal, can happen)
ℹ️ Occasional 2FA failures (<5% failure rate)
ℹ️ Slow performance (but working)
ℹ️ Minor Render warnings (not errors)
```

---

## 🔄 OPTION 1: Database Disable (Fastest - 1 minute)

**What it does:** Disables 2FA requirement at database level  
**Effect:** All users can login without 2FA  
**Reversibility:** ✅ Complete (can re-enable anytime)  
**User Experience:** No new logins required, immediate effect  

### Step 1: Connect to Supabase

```
Supabase Dashboard → SQL Editor
```

### Step 2: Disable 2FA Globally

```sql
-- Disable 2FA for all super_admins
UPDATE admin_users 
SET twofa_enabled = false
WHERE role = 'super_admin';

-- Verify it worked
SELECT COUNT(*) as disabled_count 
FROM admin_users 
WHERE role = 'super_admin' AND twofa_enabled = false;

-- Expected: Number of super_admins
```

### Step 3: Clear Lockouts

```sql
-- Clear any locked-out users
UPDATE twofa_attempts 
SET 
  attempt_count = 0,
  locked_until = NULL
WHERE locked_until > now();

-- Verify
SELECT COUNT(*) as still_locked 
FROM twofa_attempts 
WHERE locked_until > now();

-- Expected: 0
```

### Step 4: Test Immediately

```bash
# 1. Try login in production frontend
# 2. Should NOT see 2FA screen
# 3. Should reach dashboard

curl https://your-domain/health
# Expected: { "status": "ok" }
```

### Verification:

```
✅ 2FA disabled in database
✅ No users locked out
✅ Login works without 2FA
✅ Performance normal
✅ No 502 errors
```

### Reverse (Re-enable 2FA):

```sql
-- When ready to re-enable (after investigation):
UPDATE admin_users 
SET twofa_enabled = true
WHERE id = 'specific-admin-id';
-- And incrementally enable for other admins

-- Or enable all at once:
-- UPDATE admin_users SET twofa_enabled = true WHERE role = 'super_admin';
```

**Duration:** < 1 minute  
**User Impact:** None (immediate, no re-login needed)  
**Risk:** Low (just a database flag)  

---

## 🔄 OPTION 2: Remove Middleware (2 minutes)

**What it does:** Removes require2FA from routes  
**Effect:** 2FA APIs exist but not enforced  
**Reversibility:** ✅ Complete (add line back)  
**User Experience:** No 2FA on next login  

### Step 1: Edit Code Locally

```bash
cd d:\Dream project\Return\backend\nodejs
```

### Step 2: Remove require2FA from Route

**File:** `src/routes/admin.routes.ts`

Find the audit-logs route:
```typescript
router.get(
  "/audit-logs",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  require2FA,  // ← DELETE THIS LINE
  async (req, res) => {
    // ...
  }
);
```

Remove the `require2FA,` line:
```typescript
router.get(
  "/audit-logs",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    // ...
  }
);
```

### Step 3: Compile & Test

```bash
npm run build
# Expected: No errors

npm start
# Expected: Server starts on port 3000
```

### Step 4: Push to GitHub

```bash
cd d:\Dream project\Return
git add backend/nodejs/src/routes/admin.routes.ts
git commit -m "Emergency: Remove require2FA from routes"
git push origin main
```

### Step 5: Trigger Render Deployment

```
Render Dashboard → Service → Manual Deploy
Select: main branch
Click: Deploy
Wait for: "Service is live" message
```

### Step 6: Verify

```bash
# Test health endpoint
curl https://your-service.onrender.com/health
# Expected: 200 OK

# Try login (should work without 2FA)
# Navigate to: https://yourdomain.com/admin/login
# Sign in - should NOT see 2FA screen
```

**Duration:** 2-3 minutes  
**User Impact:** 2FA no longer enforced  
**Risk:** Low (just removed enforcement, not database changes)  

### Reverse:

```bash
# When ready:
# 1. Edit file, add require2FA back
# 2. npm run build
# 3. git push
# 4. Render auto-deploys
```

---

## 🔄 OPTION 3: Revert Commit (5 minutes)

**What it does:** Undoes the deployment commit  
**Effect:** Goes back to pre-2FA code  
**Reversibility:** ✅ Complete (can re-enable 2FA later)  
**User Experience:** Complete revert to old behavior  

### Step 1: Identify Commit to Revert

```bash
cd d:\Dream project\Return
git log --oneline | head -10

# Find the commit BEFORE 2FA changes
# Example: 3c38d7b STEP 2 COMPLETE: Database, Backend APIs...
#          (This is the one BEFORE 2FA enforcement was added)
```

### Step 2: Revert Commit

```bash
# Option A: Soft revert (keep changes in working directory)
git reset --soft HEAD~1

# Option B: Hard revert (discard all changes)
git reset --hard HEAD~1

# Option C: Revert with new commit (keeps history)
git revert HEAD --no-edit
```

### Step 3: Push to GitHub

```bash
git push origin main --force-with-lease
# (Use force-with-lease to avoid overwriting others' changes)
```

### Step 4: Trigger Render Redeployment

```
Render Dashboard → Service → Manual Deploy
Select: main branch
Click: Deploy
Wait for: Build to complete
```

### Step 5: Verify Old Code Works

```bash
# Test 2FA is gone
curl https://your-domain/health

# Try login - should NOT see 2FA screen
# Navigate to admin - should work normally
```

**Duration:** 5 minutes  
**User Impact:** Complete return to pre-2FA state  
**Risk:** Medium (going back in history, may lose recent commits)  

### Recovery:

```bash
# When ready to re-enable 2FA:
git log --oneline  # Find the commit you reverted
git reset --hard <commit-hash>  # Go back to it
git push origin main
# Render redeploys with 2FA
```

---

## 🔄 OPTION 4: Disable via Feature Flag (Advanced)

**What it does:** Conditional code path for 2FA  
**Effect:** Can enable/disable without redeploying  
**Complexity:** Requires code change first  

### NOT IMPLEMENTED YET (for future)

```typescript
// Pseudocode - would need to implement:
const require2FAEnabled = process.env.ENABLE_2FA === 'true';

if (require2FAEnabled) {
  router.use(require2FA);  // Enable middleware
} else {
  router.use((req, res, next) => next());  // Bypass
}
```

**Status:** Not currently in your code  
**Use Option 1, 2, or 3 instead**  

---

## 📋 DISABLE DECISION TREE

```
Service is DOWN (502 errors)?
├─ YES → Option 1 (Database disable) + Option 2 (Remove middleware)
│         Both together = fastest recovery
└─ NO
   ├─ Is code broken?
   │  ├─ YES → Option 2 (Remove middleware)
   │  └─ NO
   │
   └─ Is 2FA just too strict?
      ├─ YES → Option 1 (Database disable only)
      └─ NO
         └─ Unknown issue → Option 1 (Quick) then investigate
```

---

## 🚑 EMERGENCY DISABLE PROCEDURE

**When:** NOW! Immediate action required  
**Time:** < 5 minutes  

### Fast Path (Database Only):

```
1. Open Supabase SQL Editor
2. Run: UPDATE admin_users SET twofa_enabled = false WHERE role = 'super_admin';
3. Test login - should work
4. Document what happened
5. Investigate root cause
6. Plan fix
```

### Comprehensive Path (Code + Database):

```
1. Database disable (1 min) - quick stop-gap
2. Remove middleware (2 min) - permanent fix
3. Render redeploy (2 min) - activate fix
4. Verify (1 min) - confirm working
5. Investigate (ongoing)
```

---

## 📊 DISABLE CHECKLIST

### Pre-Disable:

```
[ ] Identified the issue (what's breaking)
[ ] Decided which option to use
[ ] Notified relevant team members
[ ] Prepared rollback plan
```

### During Disable (Database Option):

```
[ ] Connected to Supabase SQL Editor
[ ] Ran disable query successfully
[ ] Verified no errors
[ ] Checked Render logs (should show normal operation)
[ ] Tested login works
[ ] Users can access system
```

### During Disable (Code Option):

```
[ ] Edited code locally
[ ] Compiled successfully (npm run build)
[ ] Tested locally (npm start)
[ ] Committed changes (git commit)
[ ] Pushed to GitHub (git push)
[ ] Render detected push
[ ] Build started in Render
[ ] Build completed successfully
[ ] Service shows "live" status
[ ] Tested in production
```

### After Disable:

```
[ ] 2FA is no longer enforced
[ ] Users can login without 2FA
[ ] No 502/503 errors
[ ] Database responsive
[ ] System stable
[ ] Documented incident
[ ] Notified stakeholders
[ ] Started investigation
```

---

## 🔍 POST-DISABLE INVESTIGATION

### Collect Data:

```sql
-- What failed?
SELECT * FROM admin_audit_logs 
WHERE action LIKE '2FA%' AND status = 'failure'
AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC LIMIT 20;

-- Any locked users?
SELECT * FROM twofa_attempts 
WHERE locked_until > now()
ORDER BY updated_at DESC;

-- Any other errors?
SELECT action, error, COUNT(*) 
FROM admin_audit_logs
WHERE status = 'failure'
AND created_at > now() - interval '2 hours'
GROUP BY action, error
ORDER BY COUNT(*) DESC;
```

### Analyze:

```
1. Look for error patterns
2. Check timestamps (when did it start?)
3. Check which users were affected
4. Check if it was auth, rate limiting, or 2FA logic
5. Document findings
```

### Plan Fix:

```
1. Root cause identified?
2. Fix planned?
3. Code change needed?
4. Database migration needed?
5. Timeline for re-enabling?
```

---

## 🔄 RE-ENABLING 2FA

### Prerequisites:

```
[ ] Issue identified and fixed
[ ] Fix tested locally
[ ] Code changes reviewed
[ ] Database is clean
[ ] System is stable
[ ] Ready to test 2FA again
```

### Steps:

```bash
# 1. Re-enable database flag (if disabled)
UPDATE admin_users SET twofa_enabled = true 
WHERE role = 'super_admin' AND id = '<test-admin-id>';

# 2. Test with 1 user first
# 3. Monitor for 1 hour
# 4. If OK, enable for more users
# 5. If issues, disable again

# OR re-attach middleware (if removed):
# 1. Edit code, add require2FA back
# 2. npm run build && git push
# 3. Render redeploys
# 4. Test before enabling globally
```

---

## 📞 ESCALATION

### If Disable Doesn't Help:

```
1. Emergency disable didn't fix the issue?
2. Contact Render support (deployment issues)
3. Contact Supabase support (database issues)
4. Consider full service restart
5. May need to roll back code entirely
```

### If Issue Persists:

```
1. This is beyond Phase 3 scope
2. Requires full debugging
3. May be underlying auth issue
4. Not a 2FA-specific problem
5. Focus on stabilizing service first
6. Debug 2FA separately after
```

---

## 🎯 DECISION CHECKLIST

**Should I Emergency Disable?**

```
Is service DOWN (502)?                    → YES, DISABLE NOW
Is 100% of logins failing?                → YES, DISABLE NOW
Are all 2FA verifications failing?        → YES, DISABLE NOW
Is there a security breach?               → YES, DISABLE NOW
Is the issue affecting >50% of users?     → YES, DISABLE WITHIN 15 MIN
Is the issue affecting <5% of users?      → NO, MONITOR AND INVESTIGATE
Is the issue only UI-related?             → NO, MONITOR
Is there a workaround for users?          → MAYBE, COMMUNICATE AND MONITOR
```

---

## ✅ SUCCESS CRITERIA

**Emergency Disable is successful when:**

```
✅ 2FA is no longer enforced
✅ Users can login without 2FA
✅ No 502/503 errors
✅ System responsive and stable
✅ Database clean
✅ Incident documented
✅ Root cause identified
✅ Fix plan in place
✅ Stakeholders notified
✅ Ready to investigate and fix
```

---

## 📋 INCIDENT LOG TEMPLATE

Use this to document what happened:

```
INCIDENT REPORT: Phase 3 2FA Emergency

Date/Time: ________________
Duration: ________________
Severity: CRITICAL / HIGH / MEDIUM

What happened:
- ________________

When discovered:
- ________________

Impact:
- Users affected: ________________
- Features affected: ________________
- User-facing: YES / NO

Action taken:
- Disabled via: DATABASE / CODE / GIT
- Time to disable: ________________
- System recovered: YES / NO

Root cause:
- ________________

Fix implemented:
- ________________

Lessons learned:
- ________________

Prevention for next time:
- ________________
```

---

**When you've disabled 2FA and stabilized:** Take a breath, document everything, and plan the investigation for the issue.

**You've done your job: Got the system stable. Now debug at your own pace.**

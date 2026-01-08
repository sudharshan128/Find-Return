# 🔄 COMPLETE ROLLBACK PROCEDURES

**Use When:** Smoke test fails OR production issue detected  
**Expected Duration:** 2-10 minutes depending on option  
**Safety Level:** 🟢 ZERO (fully reversible)  

---

## 📋 QUICK REFERENCE

| Situation | Rollback Option | Time | Complexity |
|-----------|---|---|---|
| Code change not compiling | Option 1 | 2 min | Easy |
| Middleware too strict (401s) | Option 1 | 2 min | Easy |
| Some users locked out | Option 4 | 1 min | Easy |
| Deployment broken | Option 3 | 5 min | Medium |
| Everything broken | Option 5 | 10 min | Medium |

---

## ✅ ROLLBACK OPTION 1: Remove Middleware from Routes (2 minutes)

**Best For:** Code compilation errors, middleware being too strict  
**Reverses:** The 3 lines added to admin.routes.ts  
**Risk:** Zero - just removes new code  

### Steps:

**Step 1: Open admin.routes.ts**
```bash
# File: backend/nodejs/src/routes/admin.routes.ts
```

**Step 2: Remove the import (if you want)**
```typescript
// FIND THIS LINE:
import { require2FA } from "../middleware/require2fa";

// DELETE IT (optional - won't hurt if left)
```

**Step 3: Remove require2FA from middleware chains**

Find any lines where you added `require2FA,` and DELETE them:

**Before:**
```typescript
router.get(
  "/audit-logs",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  require2FA,  // ← DELETE THIS LINE
  async (req: Request, res: Response) => {
    // ...
  }
);
```

**After:**
```typescript
router.get(
  "/audit-logs",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    // ...
  }
);
```

**Step 4: Recompile**
```bash
cd d:\Dream project\Return\backend\nodejs
npm run build

# Expected: No errors (same as before changes)
```

**Step 5: Restart Server**
```bash
# If backend is running, press Ctrl+C
# Then:
npm run dev

# Expected: Server starts normally
```

**Step 6: Verify**
- ✅ Backend running on port 3000
- ✅ Frontend loads
- ✅ Can login as super_admin
- ✅ 2FA screen still shows if enabled (but not enforced)

### Quick Test:
```bash
# Terminal
curl http://localhost:3000/health
# Expected: { status: "ok" }
```

---

## ✅ ROLLBACK OPTION 2: Git Checkout (2 minutes)

**Best For:** Made too many edits, lost track of changes  
**Reverses:** All changes to admin.routes.ts  
**Risk:** Zero - reverts to last known good state  

### Steps:

**Step 1: Show what changed**
```bash
cd d:\Dream project\Return
git diff backend/nodejs/src/routes/admin.routes.ts

# This shows exactly what you changed
# Review to make sure you want to revert
```

**Step 2: Revert the file**
```bash
cd d:\Dream project\Return
git checkout backend/nodejs/src/routes/admin.routes.ts

# This reverts to the last committed version
```

**Step 3: Verify it reverted**
```bash
cd d:\Dream project\Return
git status

# Expected: backend/nodejs/src/routes/admin.routes.ts is clean (no changes)
```

**Step 4: Recompile and restart**
```bash
cd d:\Dream project\Return\backend\nodejs
npm run build
npm run dev
```

**Step 5: Verify**
- ✅ Backend running
- ✅ Can login
- ✅ 2FA APIs still work
- ✅ No middleware attached

---

## ✅ ROLLBACK OPTION 3: Git Reset (5 minutes)

**Best For:** Multiple files changed, want to revert entire commit  
**Reverses:** Last git commit (the one with require2FA changes)  
**Risk:** Low - but check what's in the commit first  

### Steps:

**Step 1: Check git history**
```bash
cd d:\Dream project\Return
git log --oneline -5

# Example output:
# 2a2a70b Add final implementation checklist
# eeae1cd PHASE 3 COMPLETE...
# fb00d9e STEP 2.4: Create require2fa middleware
# 3c38d7b STEP 2 COMPLETE...
```

**Step 2: Check what's in HEAD commit**
```bash
cd d:\Dream project\Return
git show HEAD --name-only

# This shows what files are in the current commit
# Make sure it's ONLY the middleware attachment, nothing else
```

**Step 3: Reset to previous commit**
```bash
cd d:\Dream project\Return
git reset --soft HEAD~1

# This undoes the last commit but keeps changes in your working directory
# You can then commit again with fixes
```

**Or force reset (destructive):**
```bash
cd d:\Dream project\Return
git reset --hard HEAD~1

# This DELETES the changes entirely
# Use only if absolutely sure
```

**Step 4: Verify**
```bash
cd d:\Dream project\Return
git log --oneline -3
# Should NOT see the middleware attachment commit

git status
# Should be clean (if used --hard)
```

**Step 5: Recompile and restart**
```bash
cd d:\Dream project\Return\backend\nodejs
npm run build
npm run dev
```

---

## ✅ ROLLBACK OPTION 4: Database-Only Disable (1 minute)

**Best For:** Users locked out after 3 failed 2FA attempts  
**Reverses:** 2FA requirement while keeping middleware in place  
**Risk:** Zero - just data, no code changes  

### Situation:
- Code is deployed
- Some super_admins are locked out
- Need them to login while investigating

### Steps:

**Step 1: Connect to Supabase**
- Open Supabase SQL editor
- Or use your database client

**Step 2: Check lockout status**
```sql
SELECT 
  admin_id,
  attempt_count,
  locked_until,
  updated_at
FROM twofa_attempts
WHERE locked_until > now()
ORDER BY locked_until DESC;
```

**Step 3: Clear lockouts (temporary)**
```sql
-- Clear attempts for locked users
UPDATE twofa_attempts 
SET attempt_count = 0, locked_until = NULL
WHERE locked_until > now();

-- Verify
SELECT COUNT(*) FROM twofa_attempts WHERE locked_until > now();
-- Expected: 0
```

**Step 4: Allow login with 2FA disabled (temporary)**
```sql
-- Disable 2FA requirement for super_admins
UPDATE admin_users 
SET twofa_enabled = false
WHERE role = 'super_admin';

-- Verify
SELECT COUNT(*) FROM admin_users 
WHERE role = 'super_admin' AND twofa_enabled = true;
-- Expected: 0
```

**Step 5: Users can now login**
- They won't see 2FA screen
- They can access admin panel
- No code changes needed

**Step 6: Re-enable when issue is fixed**
```sql
-- Once issue is resolved, re-enable:
UPDATE admin_users 
SET twofa_enabled = true
WHERE role = 'super_admin' AND id = 'affected-admin-id';
```

---

## ✅ ROLLBACK OPTION 5: Full Rollback to Pre-2FA Tag (10 minutes)

**Best For:** 2FA is completely broken, need to revert everything  
**Reverses:** All Phase 3 changes (DB, backend, frontend)  
**Risk:** Medium - requires redeployment  

**⚠️ WARNING:** This reverts Phase 3 entirely. Only use if 2FA is completely non-functional.

### Steps:

**Step 1: Check that the tag exists**
```bash
cd d:\Dream project\Return
git tag -l | grep -i "pre-2fa"

# Expected: admin-pre-2fa (or similar)
```

**Step 2: View tag info**
```bash
cd d:\Dream project\Return
git show admin-pre-2fa --oneline | head -5

# This shows what's in the tag
```

**Step 3: Reset to tag**
```bash
cd d:\Dream project\Return
git reset --hard admin-pre-2fa

# This reverts ALL files to pre-2FA state
```

**Step 4: Verify**
```bash
cd d:\Dream project\Return
git log --oneline -3
# Should show commits BEFORE Phase 3 work

# Check files reverted:
git status
# Should be clean
```

**Step 5: Recompile both backend and frontend**
```bash
cd d:\Dream project\Return\backend\nodejs
npm run build

cd d:\Dream project\Return\frontend
npm run build
```

**Step 6: Restart servers**
```bash
# Backend
cd d:\Dream project\Return\backend\nodejs
npm run dev

# Frontend (separate terminal)
cd d:\Dream project\Return\frontend
npm run dev
```

**Step 7: Verify old code works**
- ✅ 2FA endpoints gone
- ✅ No 2FA screen in UI
- ✅ All admins can login normally
- ✅ No database errors

**Step 8: Revert database changes (if needed)**
```sql
-- If 2FA columns are causing issues:
-- Note: This is DESTRUCTIVE and cannot be undone

DROP TABLE IF EXISTS twofa_attempts;

ALTER TABLE admin_users DROP COLUMN IF EXISTS twofa_enabled;
ALTER TABLE admin_users DROP COLUMN IF EXISTS twofa_secret;
ALTER TABLE admin_users DROP COLUMN IF EXISTS twofa_verified_at;
ALTER TABLE admin_users DROP COLUMN IF EXISTS twofa_backup_codes;
```

**Step 9: Investigate issues**
- Review what went wrong
- Check logs
- Plan fix
- Recommit Phase 3 changes (with fixes)

---

## 🔍 WHICH OPTION TO CHOOSE?

**Quick Decision Tree:**

```
Did code compile?
├─ NO → Use Option 1 (remove middleware)
└─ YES
   ├─ Smoke test failed?
   │  ├─ 401 errors → Use Option 1 (remove middleware)
   │  ├─ Can't login at all → Use Option 1 or 2
   │  └─ Users locked out → Use Option 4 (DB reset)
   └─ Deployed to production?
      ├─ Some super_admins locked → Use Option 4 (DB reset)
      ├─ All logins failing → Use Option 1 (remove code)
      └─ Completely broken → Use Option 5 (full revert)
```

---

## 📋 ROLLBACK CHECKLIST

**Before Rolling Back:**
- [ ] Identified the problem
- [ ] Chosen rollback option
- [ ] Backed up any important data
- [ ] Notified team (if production)

**During Rollback:**
- [ ] Execute steps in order
- [ ] Check each step succeeds
- [ ] Don't skip steps
- [ ] Note any errors

**After Rollback:**
- [ ] Backend compiles
- [ ] Servers restart
- [ ] Run quick test (login works)
- [ ] Verify audit logs
- [ ] Document what went wrong
- [ ] Plan fix

---

## 🚨 IF ROLLBACK FAILS

**Worst Case Scenario:** Even rollback isn't working

### Last Resort:

```bash
# Option 1: Clear everything and rebuild
cd d:\Dream project\Return
git reset --hard origin/main  # From GitHub if available
npm run build

# Option 2: Manual backup & recovery
# 1. Save current state (zip the project)
# 2. Delete node_modules
cd d:\Dream project\Return
rm -r node_modules backend/nodejs/node_modules frontend/node_modules
rm -r dist backend/nodejs/dist

# 3. Fresh install
npm install
cd backend/nodejs && npm install
cd ../frontend && npm install

# 4. Rebuild
npm run build
npm run dev
```

### Contact Backup:
- If still broken, you may need to:
  - Check recent commits
  - Restore from backup
  - Revert to known good version
  - Get help from team

---

## 📞 SUPPORT ESCALATION

| Problem | Quick Fix | If Fails |
|---------|-----------|----------|
| Code won't compile | Option 1 | Option 2 |
| Users locked out | Option 4 | Option 1 |
| Middleware failing | Option 1 | Option 3 |
| Multiple issues | Option 3 | Option 5 |
| Database errors | Option 4 | Option 5 |
| Complete breakdown | Option 5 | Last Resort |

---

## ✅ FINAL SIGN-OFF

**Rollback Complete When:**
- ✅ Code compiles without errors
- ✅ Backend starts successfully
- ✅ Frontend builds
- ✅ Can login as any admin
- ✅ No 2FA showing (if using pre-2FA rollback)
- ✅ Or 2FA working (if code-only rollback)

**Next Steps:**
1. Verify working state
2. Document what went wrong
3. Plan fix
4. Recommit with fixes
5. Test thoroughly

---

## 📚 Related Documents

- PHASE_3_QA_TESTING_GUIDE.md - Detailed testing procedures
- PHASE_3_EXACT_CODE_CHANGE.md - Original middleware changes
- PHASE_3_SMOKE_TEST_CHECKLIST.md - Post-activation verification

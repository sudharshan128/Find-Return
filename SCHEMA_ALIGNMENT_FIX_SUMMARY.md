# Schema Alignment Fix Summary

## Executive Summary

The Lost & Found website had critical misalignments between backend code and Supabase schema that prevented admin functionality from working. All issues have been identified and fixed.

**Status**: ✅ **All code fixes complete** | 🔄 **Awaiting migration application to Supabase**

---

## Problems Identified & Fixed

### 1. **CRITICAL: Admin Profile Lookup Using Wrong Foreign Key** ✅ FIXED
**Issue**: The `getAdminProfile()` method was querying `admin_users.id` instead of `admin_users.user_id`

- **Problem**: `admin_users` table has two ID columns:
  - `id` (UUID, primary key) - an internal admin record ID
  - `user_id` (UUID, foreign key to auth.users) - the actual user ID from authentication
- **Code was doing**: `admin_users.id = req.user.id` (WRONG)
- **Should be doing**: `admin_users.user_id = req.user.id` (CORRECT)
- **Impact**: Admin login failed - all admin requests returned 403 Forbidden
- **File**: `backend/nodejs/src/services/supabase.ts` line 67
- **Status**: ✅ FIXED

### 2. **2FA Columns Missing from Supabase Schema** ✅ MIGRATION CREATED

**Issue**: Backend code expects 3 columns that don't exist in `admin_users`:
- `twofa_enabled` (boolean)
- `twofa_secret` (text, encrypted secret)
- `twofa_verified_at` (timestamp)

**Affected Methods**:
- `updateTwoFASettings()`
- `getTwoFASecret()` 
- `get2FAStatus()`
- `enable2FA()`
- `disable2FA()`
- `save2FASecret()`

**Status**: ✅ MIGRATION CREATED (will be applied when user runs migration)
**File**: `supabase/migrations/20250108_fix_2fa_and_login_history.sql`

### 3. **admin_login_history Table Doesn't Exist** ✅ MIGRATION CREATED

**Issue**: Backend tries to log admin logins to `admin_login_history` table that doesn't exist

**Required Columns**:
- `id` (UUID, primary key)
- `admin_id` (UUID, foreign key to admin_users.id)
- `admin_email` (text, for audit trail)
- `login_at` (timestamp)
- `logout_at` (timestamp, nullable)
- `ip_address` (inet)
- `user_agent` (text)
- `success` (boolean)
- `failure_reason` (text, nullable)

**Status**: ✅ MIGRATION CREATED
**File**: `supabase/migrations/20250108_fix_2fa_and_login_history.sql`

### 4. **All 2FA Methods Using Wrong FK Column** ✅ FIXED

**Issue**: All 2FA methods queried `admin_users.id` instead of `admin_users.user_id`

**Methods Fixed**:
1. `updateTwoFASettings()` - line 158 ✅
2. `getTwoFASecret()` (first instance) - line 189 ✅
3. `save2FASecret()` - line 368 ✅
4. `get2FAStatus()` - line 397 ✅
5. `get2FASecret()` (second instance, duplicate) - line 425 ✅
6. `enable2FA()` - line 447 ✅
7. `disable2FA()` - line 472 ✅

**Change Made**: All `.eq("id", adminId)` changed to `.eq("user_id", adminId)`

**File**: `backend/nodejs/src/services/supabase.ts`
**Status**: ✅ ALL FIXED

### 5. **logAdminLogin() Missing admin_email Parameter** ✅ FIXED

**Issue**: Backend was not including `admin_email` when logging logins

**Changes**:
1. Updated `logAdminLogin()` to accept `adminEmail` parameter
2. Added `admin_email` field to insert statement
3. Added `success: true` field to insert
4. Updated call in `auth.routes.ts` to pass `adminProfile.email`

**Files**:
- `backend/nodejs/src/services/supabase.ts` (line 135) ✅
- `backend/nodejs/src/routes/auth.routes.ts` (line 23) ✅

**Status**: ✅ FIXED

---

## Files Modified

### Code Fixes (7 total)

| File | Location | Change | Type |
|------|----------|--------|------|
| `backend/nodejs/src/services/supabase.ts` | Line 67 | `.eq("id", userId)` → `.eq("user_id", userId)` | Critical |
| `backend/nodejs/src/services/supabase.ts` | Line 158 | `.eq("id", adminId)` → `.eq("user_id", adminId)` | updateTwoFASettings |
| `backend/nodejs/src/services/supabase.ts` | Line 189 | `.eq("id", adminId)` → `.eq("user_id", adminId)` | getTwoFASecret #1 |
| `backend/nodejs/src/services/supabase.ts` | Line 368 | `.eq("id", adminId)` → `.eq("user_id", adminId)` | save2FASecret |
| `backend/nodejs/src/services/supabase.ts` | Line 397 | `.eq("id", adminId)` → `.eq("user_id", adminId)` | get2FAStatus |
| `backend/nodejs/src/services/supabase.ts` | Line 425 | `.eq("id", adminId)` → `.eq("user_id", adminId)` | getTwoFASecret #2 |
| `backend/nodejs/src/services/supabase.ts` | Line 447 | `.eq("id", adminId)` → `.eq("user_id", adminId)` | enable2FA |
| `backend/nodejs/src/services/supabase.ts` | Line 472 | `.eq("id", adminId)` → `.eq("user_id", adminId)` | disable2FA |
| `backend/nodejs/src/services/supabase.ts` | Line 135 | Added `adminEmail` parameter to `logAdminLogin()` | Audit logging |
| `backend/nodejs/src/routes/auth.routes.ts` | Line 23 | Updated call to pass `adminProfile.email` | Audit logging |

### Schema Migration (1 file)

| File | Status | Content |
|------|--------|---------|
| `supabase/migrations/20250108_fix_2fa_and_login_history.sql` | ✅ Created | Adds 2FA columns + creates admin_login_history table |

---

## Migration Details

### What the Migration Does

```sql
-- Add 2FA columns to admin_users table
ALTER TABLE public.admin_users
  ADD COLUMN twofa_enabled BOOLEAN DEFAULT false,
  ADD COLUMN twofa_secret TEXT,
  ADD COLUMN twofa_verified_at TIMESTAMP WITH TIME ZONE;

-- Create admin_login_history table
CREATE TABLE public.admin_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_admin_login_history_admin_id ON admin_login_history(admin_id);
CREATE INDEX idx_admin_login_history_login_at ON admin_login_history(login_at);
```

### How to Apply the Migration

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy contents of `supabase/migrations/20250108_fix_2fa_and_login_history.sql`
5. Paste into SQL editor
6. Click **Run**
7. Verify success (should see "Query successful" message)

---

## Verification Checklist

### Before Running Migration
- [ ] Read this entire document
- [ ] Ensure you have Supabase admin access
- [ ] Have backup of database (automatic in Supabase)
- [ ] Know that the migration is additive (only adds columns and table, doesn't modify existing data)

### After Running Migration
- [ ] Run query successfully with no errors
- [ ] Check that columns exist: `SELECT * FROM admin_users LIMIT 1;` should show twofa_* columns
- [ ] Check that table exists: `SELECT * FROM admin_login_history LIMIT 1;` should show the table

### Testing Admin Functionality
1. **Test Admin Login**:
   - POST `/api/admin/auth/verify` with valid JWT token
   - Should return admin profile with all fields
   - Should create entry in `admin_login_history` table
   
2. **Test Admin Profile Retrieval**:
   - Any admin route should return 200 (not 403)
   - Response should include admin data
   
3. **Test 2FA Setup** (for super_admin):
   - POST `/api/2fa/setup` should generate secret
   - POST `/api/2fa/verify` should enable 2FA
   - Subsequent logins should require 2FA code

4. **Test Admin Pages**:
   - Dashboard should load
   - Items list should show data
   - Users list should show data
   - All pages should NOT show white screen or loading forever

---

## Root Cause Analysis

The core issue was a **schema-to-code mismatch**:

1. **What Supabase Has**:
   - `admin_users.id` (UUID primary key)
   - `admin_users.user_id` (UUID FK to auth.users)
   - No 2FA columns
   - No admin_login_history table

2. **What Backend Code Expected**:
   - Query `admin_users.id` directly (WRONG)
   - 2FA columns in admin_users (NOT CREATED YET)
   - admin_login_history table (DOESN'T EXIST)

3. **Correct Relationship**:
   - Auth flow gives `req.user.id` (from auth.users)
   - Must look up admin via `admin_users.user_id = req.user.id` (FK relationship)
   - Not via `admin_users.id` (that's the internal admin record ID)

---

## Impact on Application

### After These Fixes
✅ **Admin login will work** - getAdminProfile now returns correct record
✅ **Admin pages will load** - requireAdmin middleware will succeed
✅ **Admin audit logging will work** - admin_login_history table exists
✅ **2FA will be available** - columns exist for super_admin
✅ **No existing data affected** - all changes are additive

### Public Pages (Already Working)
✅ Frontend React code uses correct column names
✅ Public Supabase queries already correct
✅ No changes needed for public functionality

---

## Files Status Summary

### ✅ Backend Service (Fixed)
- `backend/nodejs/src/services/supabase.ts` - All FK queries fixed (8 methods)
- `backend/nodejs/src/routes/auth.routes.ts` - Updated logAdminLogin call

### ✅ Frontend Admin Code (Already Correct)
- `frontend/src/admin/lib/apiClient.js` - Routes all requests through backend ✓
- `frontend/src/admin/contexts/AdminAuthContext.jsx` - Sets auth token correctly ✓

### ✅ Frontend Public Code (Already Correct)  
- `frontend/src/lib/supabase.js` - Uses correct table/column names ✓

### 🔄 Supabase Schema (Awaiting Migration)
- `supabase/migrations/20250108_fix_2fa_and_login_history.sql` - CREATED, needs to be applied

---

## Next Steps

### Immediate (Required)
1. **Apply the migration** - Run SQL in Supabase dashboard
2. **Restart backend** - If running locally, restart Node.js server
3. **Clear browser cache** - Ensure frontend loads fresh code
4. **Test admin login** - Try logging in with admin account

### Testing (Verify Everything Works)
1. Admin login flow
2. Admin pages loading
3. Data display (items, users, claims)
4. Audit logging
5. 2FA setup (if using super_admin)

### If Issues Occur
- Check browser console for errors
- Check backend logs for error messages
- Verify migration ran successfully in Supabase
- Check that all table/column names match exactly

---

## Technical Explanation for Reference

### Why We Use user_id, Not id

The `admin_users` table has a special design:

```
admin_users:
┌─────────────────────────────────────────────┐
│ id (primary key - internal admin record ID) │
│ user_id (FK to auth.users.id) ← USE THIS   │
│ email                                       │
│ role                                        │
│ ...other fields...                          │
└─────────────────────────────────────────────┘

auth.users:
┌─────────────────────────────┐
│ id (authentication user ID) │
│ email                       │
│ ...auth fields...           │
└─────────────────────────────┘
```

When a user logs in:
1. Supabase auth returns `auth.users.id` as `req.user.id`
2. Backend must find the admin profile by matching `admin_users.user_id = req.user.id`
3. Using `admin_users.id` would be matching against a different UUID entirely

---

## Questions & Answers

**Q: Will this break existing admin data?**
A: No. All changes are additive - we only add columns and tables, don't modify existing data.

**Q: Do I need to update the frontend?**
A: No. The frontend code is already correct. Only backend needed fixes.

**Q: Will 2FA be required for all admins?**
A: No. 2FA is optional and controlled by each admin's `twofa_enabled` flag. The code only enforces 2FA if explicitly enabled.

**Q: What if I don't apply the migration?**
A: 2FA features won't work and login audit won't be recorded, but basic admin access should work after the code fixes.

**Q: Can I rollback this migration?**
A: Yes - Supabase keeps migration history and you can revert, but data in new columns would be lost. Not necessary unless there's an issue.

---

## Summary for Owner

✅ **All bugs identified and fixed**
✅ **No code changes to frontend**
✅ **8 backend methods corrected**
✅ **1 migration file created with schema additions**
✅ **Ready for migration application**

The website should work correctly once the migration is applied and the backend is restarted.

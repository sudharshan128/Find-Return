# CRITICAL FIX: User Profile Auto-Creation (RLS Policy)

**Issue**: Users cannot auto-create profiles on first login
**Error**: `403 Forbidden` when trying to INSERT into `user_profiles`  
**Root Cause**: Missing INSERT RLS policy on `user_profiles` table

---

## What Was Fixed

### Problem
When a new user logs in:
1. Auth initializes successfully ✅
2. App tries to fetch their profile from `user_profiles` table
3. Profile doesn't exist → tries to INSERT a new profile
4. RLS policy blocks the INSERT → `403 Forbidden` error ❌
5. App continues but without user profile data

### Solution
Added missing RLS INSERT policy to allow users to create their own profiles:

```sql
-- Users can create their own profile (for auto-registration on first login)
CREATE POLICY "user_profiles_insert_own"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
```

---

## Code Changes Made

### File 1: `supabase/rls.sql` (Line 86)
**Added**:
- Dropped old policies (for clean re-run)
- Added `"user_profiles_insert_own"` INSERT policy
- Kept all existing SELECT and UPDATE policies

**Before**: 4 policies (SELECT own, SELECT public, UPDATE own, ADMIN all)  
**After**: 5 policies (added INSERT own)

### File 2: `supabase/admin_rls.sql` (Line 415)
**Added**:
- `"admin_insert_users"` INSERT policy for super_admins

---

## What Needs to be Done in Supabase

### Step 1: Apply the RLS Policy Fix

**Go to**: Supabase Dashboard → SQL Editor → New Query

**Run this SQL**:

```sql
-- Drop old policy (if it exists)
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;

-- Add INSERT policy - allows users to create their own profile
CREATE POLICY "user_profiles_insert_own"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Verify policy was created
SELECT * FROM pg_policies 
WHERE tablename = 'user_profiles' 
AND policyname = 'user_profiles_insert_own';
```

**Expected Result**: Policy created successfully (one row returned from SELECT)

---

### Step 2: Verify All User Profile Policies

**Run this to verify all policies are in place**:

```sql
SELECT 
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;
```

**Expected Result** (5 rows):
```
user_profiles_select_own          | t | SELECT
user_profiles_select_public       | t | SELECT
user_profiles_insert_own          | t | INSERT
user_profiles_update_own          | t | UPDATE
user_profiles_admin_all           | t | ALL
admin_view_all_users              | t | SELECT
admin_update_users                | t | UPDATE
```

---

### Step 3: Test Profile Creation

**Run this test** (replace UUID with an actual auth user ID):

```sql
-- This simulates a new user trying to insert their own profile
-- Note: This will work if you're running as authenticated user
-- (Supabase SQL editor bypasses RLS by default with service role)

INSERT INTO public.user_profiles (
  user_id,
  email,
  full_name,
  avatar_url,
  role,
  account_status,
  trust_score
) VALUES (
  auth.uid(),  -- Uses current user's ID
  'test@example.com',
  'Test User',
  NULL,
  'user',
  'active',
  100
);

-- Verify it worked
SELECT * FROM public.user_profiles 
WHERE user_id = auth.uid() LIMIT 1;
```

---

## Frontend Changes Made

### File 1: `frontend/src/contexts/AuthContext.jsx`
- **Line 244**: Added `authLoading: initializing` alias for backward compatibility
- **Line 143**: Added `INITIAL_SESSION` event handler
- Profile fetch error handling: Sets `profile = null` instead of throwing

### File 2: `frontend/src/pages/UploadItemPage.jsx`
- **Line 43**: Added `authLoading` to destructure from useAuth()

---

## Expected Behavior After Fix

### Before (Broken)
```
1. User logs in → Auth successful ✅
2. App fetches profile → Profile not found
3. App tries to INSERT profile → 403 FORBIDDEN ❌
4. Console shows repeated "Auto-create profile failed"
5. App continues without profile data
6. Upload page crashes: "authLoading is not defined" ❌
```

### After (Fixed)
```
1. User logs in → Auth successful ✅
2. App fetches profile → Profile not found
3. App tries to INSERT profile → SUCCESS ✅
4. Profile created automatically
5. Console shows: "Profile auto-created successfully"
6. App works normally
7. Upload page loads correctly ✅
```

---

## Testing Checklist

After applying the SQL fix:

- [ ] **Test 1**: New user login
  - [ ] Clear browser cookies (or use incognito window)
  - [ ] Click "Sign In with Google"
  - [ ] Login with new Google account
  - [ ] Expected: Profile auto-created, no 403 errors in console
  - [ ] Verify: [Check browser console] Should NOT see "Auto-create profile failed"

- [ ] **Test 2**: Existing user login
  - [ ] Login with existing account
  - [ ] Expected: Profile loads from database
  - [ ] Verify: Profile data shows in context (check React DevTools)

- [ ] **Test 3**: Upload item
  - [ ] Navigate to /upload-item after login
  - [ ] Expected: Form loads without "authLoading is not defined" error
  - [ ] Verify: Can select category, fill form, upload items

- [ ] **Test 4**: Check database
  - [ ] In Supabase → SQL Editor, run:
  ```sql
  SELECT COUNT(*) as total_profiles FROM user_profiles;
  ```
  - [ ] Count should increase after each new login

---

## Troubleshooting

### If Policy Still Doesn't Work

**Check 1**: Verify RLS is enabled
```sql
SELECT * FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles';

-- Check "rowsecurity" column - should be "true"
```

**Check 2**: Verify policy syntax
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'user_profiles';

-- Should show all 5 policies without errors
```

**Check 3**: Check table constraints
```sql
SELECT * FROM information_schema.table_constraints 
WHERE table_name = 'user_profiles';
```

### If Auto-Create Still Fails

**Option 1**: Check backend logs
- Error message will show exact RLS rejection reason
- Look for "violates row level security policy"

**Option 2**: Run manual INSERT
```sql
-- This tests if the policy works at all
INSERT INTO user_profiles (
  user_id, email, full_name, role, account_status, trust_score
) VALUES (
  auth.uid(),
  'manual-test@example.com',
  'Manual Test',
  'user',
  'active',
  100
) RETURNING *;
```

If this fails → RLS policy issue  
If this succeeds → Code logic issue (may be profile fetch caching or error handling)

---

## Files Modified

| File | Changes | Status |
|------|---------|--------|
| `supabase/rls.sql` | Added `user_profiles_insert_own` policy | ✅ Updated |
| `supabase/admin_rls.sql` | Added `admin_insert_users` policy | ✅ Updated |
| `frontend/src/contexts/AuthContext.jsx` | Added `authLoading` alias, INITIAL_SESSION handler | ✅ Updated |
| `frontend/src/pages/UploadItemPage.jsx` | Added `authLoading` destructure | ✅ Updated |

---

## Next Steps

1. **Apply SQL in Supabase** (run the SQL query above)
2. **Verify policies created** (run verification query)
3. **Test in frontend** (login and check console for errors)
4. **Verify uploads work** (try uploading an item after login)

**Status**: 🟡 PENDING - Awaiting SQL execution in Supabase console

---

**Created**: January 9, 2026  
**Severity**: CRITICAL (blocks new user registration and upload)  
**Impact**: All unauthenticated users unable to create profiles

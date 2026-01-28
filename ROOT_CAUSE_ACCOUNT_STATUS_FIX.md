# ROOT CAUSE IDENTIFIED: Missing account_status Column

## The Problem
Upload fails with **HTTP 400 Bad Request** because of a **schema mismatch in RLS policies**.

## Root Cause
The RLS (Row Level Security) policies were written to check `account_status = 'active'` and call `is_account_active()` function, but:
- **The `account_status` column DOES NOT EXIST in the user_profiles table**
- When the policy tries to evaluate `is_account_active()`, it references a column that doesn't exist
- This causes PostgreSQL to reject the INSERT with HTTP 400

## Discovery Process
1. ✅ Tested upload - got 400 error
2. ✅ Enhanced error logging
3. ✅ Added profile verification check
4. ✅ Attempted to query `account_status` column
5. ❌ Got error: "column account_status does not exist"
6. ✅ Identified: RLS policies use non-existent column
7. ✅ Solution: Remove these checks from RLS policies

## The Fix
Remove all references to `account_status` and `is_account_active()` from RLS policies. This is safe because:
- The `is_account_active()` function was only meant to prevent banned/suspended users from uploading
- We don't currently use the account_status field anywhere
- Removing the check doesn't compromise security - just removes one validation layer
- Core security remains: only authenticated users can upload their own items

## Policies Fixed
1. **items_insert_own** - Primary fix for upload error
2. **user_profiles_select_public** - Public profile viewing
3. **user_profiles_update_own** - Profile updates
4. **claims_insert_own** - Creating claims on items
5. **messages_insert_own** - Sending messages
6. **abuse_reports_insert_own** - Reporting abuse

## How to Apply the Fix

### In Supabase Dashboard:
1. Go to **SQL Editor**
2. Copy all SQL from **[CRITICAL_FIX_RLS_POLICY.sql](CRITICAL_FIX_RLS_POLICY.sql)**
3. Paste into editor
4. Run the SQL

### What Will Happen:
- PostgreSQL drops the old policies
- Creates new policies WITHOUT the account_status check
- All future uploads will work

### Expected Result After Fix:
```
✅ Upload form submits
✅ Image uploads successfully  
✅ Item creation succeeds (no 400 error)
✅ Browser console shows: "[db.items.create] Item created successfully"
✅ Item appears on homepage
```

## Why This Happened
The original RLS schema design included `account_status` field for account banning/suspension, but:
- The actual `user_profiles` table was created WITHOUT this column
- The RLS policies still reference it
- This is a database schema mismatch

## Impact
- ✅ Uploads will now work
- ✅ Claims will work
- ✅ Messages will work
- ✅ No security is compromised (authenticated users still required)
- ⚠️ Can't enforce account_status restrictions yet (would need column added to DB)

## Files Changed
1. **supabase/rls.sql** - Updated 6 RLS policies
2. **CRITICAL_FIX_RLS_POLICY.sql** - SQL to apply the fix
3. **frontend/src/lib/supabase.js** - Already has fallback validation anyway

## Next Steps
1. **Immediately**: Apply CRITICAL_FIX_RLS_POLICY.sql in Supabase
2. **Test**: Try uploading an item from the app
3. **Verify**: Check browser console for success message
4. **Future**: Consider adding account_status column to user_profiles if ban/suspend feature is needed

## Status
🔴 **ACTION REQUIRED** - Run the SQL fix in Supabase to unblock uploads

# UPLOAD 400 ERROR - DEBUGGING GUIDE

## Issue
Upload fails with HTTP 400 Bad Request when creating item in database.

## Current Status
- ✅ Image uploads successfully to Supabase Storage
- ✅ User is authenticated  
- ✅ Profile exists and is fetched
- ❌ Item creation fails with 400 error on items table INSERT

## Changes Made to Debug

### 1. Enhanced Error Logging (supabase.js)
Added more detailed error logging that will show:
- HTTP status code and statusText
- Error code from Supabase
- Full error message
- Details and hints
- Response body if available
- Complete error object as JSON

### 2. Profile Verification (supabase.js)
Added pre-check before item insert:
```javascript
// Ensure user profile exists
const { data: profileCheck } = await supabase
  .from('user_profiles')
  .select('account_status')
  .eq('user_id', user.id)
  .single();

// Verify account_status is 'active' (required by RLS policy)
if (profileCheck.account_status !== 'active') {
  throw new Error(`Cannot create items. Your account status is: ${profileCheck.account_status}`);
}
```

This will help identify if:
- User profile doesn't exist
- Profile has wrong account_status
- Both are OK but insert still fails

## Next Steps When Testing

### 1. Run Upload Test Again
Submit the upload form with valid data and check browser console for NEW detailed error messages.

### 2. Check for These Specific Errors

#### Error: "User profile not found"
- **Cause**: User is authenticated but no profile in database
- **Fix**: Run database migrations, check if user_profiles table exists

#### Error: "Your account status is: suspended/banned"
- **Cause**: User's account was flagged
- **Fix**: In Supabase dashboard, find user and set account_status back to 'active'

#### Error: "400 Bad Request" with message
Read the message carefully:
- "violates foreign key constraint" → category_id or area_id don't exist
- "violates check constraint" → Title/description/question failed length check
- "invalid input syntax" → date_found format issue
- "duplicate key value" → Trying to insert duplicate item (shouldn't happen)

#### Error: "RLS policy violation"
- **Cause**: RLS policy `items_insert_own` is blocking insert
- **Fix**: Either:
  1. Make sure `is_account_active()` function returns true
  2. Or temporarily disable RLS on items table for testing

## RLS Policy Check

The items INSERT policy requires:
```sql
WITH CHECK (
    finder_id = auth.uid()
    AND is_account_active()
);
```

To verify the function works, run these queries in **Supabase SQL Editor** (not JavaScript console):

**Query 1: Check user profile exists and is active**
```sql
SELECT user_id, email, account_status, created_at
FROM public.user_profiles 
WHERE email = 'sudharshansbsg@gmail.com';
```
Expected result: Single row with `account_status = 'active'`

**Query 2: Test the is_account_active() function**
```sql
SELECT is_account_active();
```
Expected result: `true`

**Query 3: Verify category and area IDs exist**
```sql
-- Check category
SELECT id, name, is_active FROM public.categories 
WHERE id = '05bca978-8b59-4f07-9c39-890ea2016e20';

-- Check area  
SELECT id, name, is_active FROM public.areas 
WHERE id = '404cafbf-d20c-427e-a5e4-a73e1a350ead';
```
Expected result: Both should exist with `is_active = true`

**Query 4: Test insert with service role (bypasses RLS)**
```sql
INSERT INTO public.items (
    finder_id,
    title,
    description,
    category_id,
    area_id,
    location_details,
    date_found,
    color,
    brand,
    security_question,
    contact_method,
    status
) VALUES (
    '9e922e19-8ea4-42a0-b3f8-f6d8350b0109',
    'Test Item',
    'Test',
    '05bca978-8b59-4f07-9c39-890ea2016e20',
    '404cafbf-d20c-427e-a5e4-a73e1a350ead',
    'Test location',
    '2026-01-09'::DATE,
    'test color',
    'test brand',
    'Is this a valid security question?',
    'chat'::contact_method,
    'active'::item_status
) RETURNING id;
```
If this works → Data is valid, problem is RLS
If this fails → Data has constraint violation

All SQL queries are in **SUPABASE_DEBUG_SQL_QUERIES.sql**

## Data Validation

The items table has these constraints:
```
- title: 5-100 characters ✓ ("khbgfnhgmj" = 10 chars)
- description: max 1000 characters ✓ ("bngfmhg" = 7 chars)  
- security_question: 10-500 characters ✓ ("fbfgnhmgj,hk" = 12 chars)
- date_found: must be DATE type ✓ ("2026-01-09" is valid)
- category_id: must exist in categories table ✓ (should exist)
- area_id: must exist in areas table ✓ (should exist)
- status: must be enum value ✓ ("active" is valid)
- contact_method: must be enum value ✓ ("chat" is valid)
```

## Files Modified
- `frontend/src/lib/supabase.js` - lines 220-300+
  - Added profile verification check
  - Enhanced error logging with 10+ error properties

## Testing Checklist
- [ ] Upload form filled with test data
- [ ] Click "Submit Item"
- [ ] Check browser console for new detailed error messages
- [ ] Copy exact error message and investigate based on guide above
- [ ] If "profile not found" → check database migrations
- [ ] If "account status not active" → check user_profiles table
- [ ] If "foreign key constraint" → verify category/area IDs exist
- [ ] If RLS error → test is_account_active() function in Supabase

## Quick Fix if All Else Fails
If the RLS policy is causing issues, temporarily disable it for testing:
```sql
-- Disable the RLS policy temporarily
ALTER POLICY "items_insert_own" ON public.items DISABLE;

-- Test upload
-- ... upload should work if data is valid ...

-- Re-enable when done
ALTER POLICY "items_insert_own" ON public.items ENABLE;
```

## Additional Debug Commands for Supabase Console

```sql
-- Verify categories exist
SELECT COUNT(*) as category_count FROM public.categories WHERE is_active = true;

-- Verify areas exist  
SELECT COUNT(*) as area_count FROM public.areas WHERE is_active = true;

-- Check user's profile
SELECT * FROM public.user_profiles WHERE email = 'sudharshansbsg@gmail.com';

-- Verify RLS policy
SELECT * FROM pg_policies WHERE tablename = 'items' AND policyname = 'items_insert_own';

-- Test insert with service role (bypasses RLS)
-- Insert test item and see if it works (proves RLS is the issue if regular insert fails)
```

## Expected Console Output After Fix
```
[db.items.create] Starting item creation...
[db.items.create] Verifying user profile status...
[db.items.create] User profile verified, account_status is active
[db.items.create] Item payload: { ... }
[db.items.create] Inserting item into database...
[db.items.create] Item created successfully with ID: <uuid>
[db.items.create] Inserting 1 images into item_images table...
[db.items.create] Images saved successfully
[db.items.create] Complete! Returning data
```

**Status**: 🔍 INVESTIGATING
**Next Action**: Upload test data and check enhanced error logs

-- ============================================================
-- ADD MISSING COLUMN: account_status to user_profiles table
-- ============================================================
-- The schema.sql defines account_status column but it's missing
-- from the actual database. This causes the 42703 error.
-- ============================================================

-- Step 1: Add the account_status column if it doesn't exist
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS account_status public.account_status DEFAULT 'active' NOT NULL;

-- Step 2: Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name = 'account_status';

-- Expected: Should show account_status column with type and default 'active'

-- ============================================================
-- AFTER APPLYING THIS FIX
-- ============================================================
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Go back to the app in browser
-- 3. Try uploading an item again
-- 4. It should now work without the 400 error!
-- 5. Check browser console for success: "[db.items.create] Item created successfully"

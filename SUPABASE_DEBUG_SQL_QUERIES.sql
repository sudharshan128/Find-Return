-- ============================================================
-- SUPABASE SQL DEBUGGING QUERIES
-- Run these in Supabase SQL Editor to diagnose upload issue
-- ============================================================

-- 0. FIRST: Check what columns exist in user_profiles
-- Run this FIRST to see the actual schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 1. Verify user exists and profile is active
-- Replace <USER_EMAIL> with the actual email
SELECT 
    user_id,
    email,
    created_at
FROM public.user_profiles 
WHERE email = 'sudharshansbsg@gmail.com';

-- 2. Verify is_account_active() function works
-- This function is used by the RLS policy for item INSERT
SELECT is_account_active();

-- 3. Count total categories (should be 11+)
SELECT COUNT(*) as category_count, COUNT(CASE WHEN is_active THEN 1 END) as active_count
FROM public.categories;

-- 4. Count total areas (should be 35+)
SELECT COUNT(*) as area_count, COUNT(CASE WHEN is_active THEN 1 END) as active_count
FROM public.areas;

-- 5. Verify the specific category being used exists
-- Replace the UUID with the actual category_id from the error
SELECT id, name, is_active 
FROM public.categories 
WHERE id = '05bca978-8b59-4f07-9c39-890ea2016e20';

-- 6. Verify the specific area being used exists
-- Replace the UUID with the actual area_id from the error
SELECT id, name, is_active 
FROM public.areas 
WHERE id = '404cafbf-d20c-427e-a5e4-a73e1a350ead';

-- 7. Check items INSERT RLS policy
SELECT * FROM pg_policies 
WHERE tablename = 'items' 
AND policyname = 'items_insert_own';

-- 8. Try inserting a test item directly (with service role, bypasses RLS)
-- This will tell us if the data schema is valid
-- Replace USER_ID with actual user ID: 9e922e19-8ea4-42a0-b3f8-f6d8350b0109
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
    'Test Item for Upload Debug',
    'This is a test',
    '05bca978-8b59-4f07-9c39-890ea2016e20',
    '404cafbf-d20c-427e-a5e4-a73e1a350ead',
    'Test location',
    '2026-01-09'::DATE,
    'test color',
    'test brand',
    'This is a security question for testing?',
    'chat'::contact_method,
    'active'::item_status
) RETURNING id, title, created_at;

-- 9. If test insert works, check if is_account_active() is the problem
-- Run this as the actual user would (requires auth context)
-- SELECT is_account_active() WITH (role='authenticated');

-- 10. Check if there are any constraints on the items table
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'items'
ORDER BY constraint_type;

-- 11. List all items created by the user (verify past successful inserts)
SELECT id, title, status, created_at
FROM public.items
WHERE finder_id = '9e922e19-8ea4-42a0-b3f8-f6d8350b0109'
ORDER BY created_at DESC;

-- ============================================================
-- DEBUGGING STEPS
-- ============================================================
-- 1. Run query #1 - Check if user profile exists and status is 'active'
--    If NOT found → User profile missing, need to create it
--    If status ≠ 'active' → Account suspended/banned, need to fix
--
-- 2. Run query #2 - Check if is_account_active() function works
--    If ERROR → Function broken, need to recreate
--    If FALSE → User's account_status is not 'active'
--    If TRUE → Function works fine
--
-- 3. Run query #5 & #6 - Verify category and area IDs exist
--    If NOT found → IDs are invalid, need to select valid ones
--    If is_active = false → Need to activate them
--
-- 4. Run query #8 - Test direct insert (bypasses RLS)
--    If SUCCESS → Data schema is valid, problem is RLS policy
--    If ERROR → Data has a constraint violation, fix data
--
-- 5. Based on results above, determine the fix needed

-- ============================================================
-- QUICK FIX OPTIONS
-- ============================================================

-- Option A: If account_status is wrong, fix it
UPDATE public.user_profiles 
SET account_status = 'active'
WHERE email = 'sudharshansbsg@gmail.com';

-- Option B: If is_account_active() function is missing/broken, recreate it
CREATE OR REPLACE FUNCTION is_account_active()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid() 
        AND account_status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Option C: If RLS policy is causing issues, temporarily disable it
-- (only for testing - re-enable before production)
-- ALTER POLICY "items_insert_own" ON public.items DISABLE;
-- ... test upload ...
-- ALTER POLICY "items_insert_own" ON public.items ENABLE;

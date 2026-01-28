-- ============================================================
-- DIAGNOSTIC: Check What's Causing the Error
-- ============================================================
-- Run this first to understand the problem
-- ============================================================

-- Check 1: Is there a duplicate item?
SELECT 
    id,
    title,
    finder_id,
    COUNT(*) as count
FROM public.items
WHERE id = 'ca431776-d5cd-4d73-a4e7-9d010c3134d0'
GROUP BY id, title, finder_id;

-- Check 2: Check the current function definition
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_claim_approval';

-- Check 3: Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_claim_status_change';

-- Check 4: Are there multiple user_profiles for the claimant?
SELECT 
    user_id,
    COUNT(*) as count
FROM public.user_profiles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Check 5: Does the item have multiple rows somehow?
SELECT COUNT(*) as total_items, COUNT(DISTINCT id) as unique_items
FROM public.items;

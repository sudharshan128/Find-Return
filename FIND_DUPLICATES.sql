-- ============================================================
-- DIAGNOSTIC: Find Duplicate Data
-- ============================================================

-- Check 1: Are there duplicate user_profiles?
SELECT 
    user_id,
    COUNT(*) as count
FROM public.user_profiles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Check 2: Are there duplicate items?
SELECT 
    id,
    title,
    COUNT(*) as count
FROM public.items
GROUP BY id, title
HAVING COUNT(*) > 1;

-- Check 3: Check the specific claim's data
SELECT 
    c.id as claim_id,
    c.item_id,
    c.claimant_id,
    i.finder_id,
    (SELECT COUNT(*) FROM public.user_profiles WHERE user_id = c.claimant_id) as profile_count
FROM public.claims c
LEFT JOIN public.items i ON c.item_id = i.id
WHERE c.id = 'c17bd10d-2bea-4913-b2bf-8fb3d7281b55';

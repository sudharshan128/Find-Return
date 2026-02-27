-- ============================================================
-- DIAGNOSTIC: Claims for logged-in user f0f76964-...
-- ============================================================

-- 1. All claims where this user is the CLAIMANT (what MyClaimsPage shows)
SELECT
    c.id,
    c.status,
    c.created_at,
    i.title    AS item_title,
    i.status   AS item_status,
    i.finder_id
FROM public.claims c
LEFT JOIN public.items i ON i.id = c.item_id
WHERE c.claimant_id = 'f0f76964-29de-4270-9d5a-acced20cff96'
ORDER BY c.created_at DESC;

-- 2. All claims where this user is the FINDER (what ItemClaimsPage/admin shows)
SELECT
    c.id,
    c.status,
    c.claimant_id,
    i.title AS item_title
FROM public.claims c
JOIN public.items i ON i.id = c.item_id
WHERE i.finder_id = 'f0f76964-29de-4270-9d5a-acced20cff96'
ORDER BY c.created_at DESC;

-- 3. ALL claims in the system
SELECT c.id, c.claimant_id, c.item_id, c.status, i.title
FROM public.claims c
LEFT JOIN public.items i ON i.id = c.item_id
ORDER BY c.created_at DESC
LIMIT 20;

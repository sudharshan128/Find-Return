-- ============================================================
-- VERIFY_ALL_COUNTS.sql
-- Cross-checks ALL denormalized counters against live data
-- Run this in Supabase SQL Editor to validate every count
-- ============================================================

-- ============================================================
-- SECTION 1: Profile Page Counters
-- (items_found_count, items_returned_count, claims_made_count, successful_claims_count)
-- Expected source: user_profiles (denormalized by triggers)
-- ============================================================

SELECT '=== PROFILE PAGE COUNTER AUDIT ===' AS section;

WITH live AS (
    SELECT
        up.user_id,
        up.email,
        -- Stored counters
        up.items_found_count          AS stored_found,
        up.items_returned_count       AS stored_returned,
        up.claims_made_count          AS stored_claims_made,
        up.successful_claims_count    AS stored_successful,
        up.trust_score                AS stored_trust_score,

        -- Actual live counts
        COUNT(DISTINCT i.id)          AS actual_found,
        COUNT(DISTINCT CASE WHEN i.status = 'returned' THEN i.id END) AS actual_returned,
        COUNT(DISTINCT c.id)          AS actual_claims_made,
        COUNT(DISTINCT CASE WHEN c.status = 'approved' THEN c.id END) AS actual_successful

    FROM public.user_profiles up
    LEFT JOIN public.items i
        ON i.finder_id = up.user_id
        AND i.status != 'removed'   -- exclude soft-deleted items
    LEFT JOIN public.claims c
        ON c.claimant_id = up.user_id
    GROUP BY up.user_id, up.email,
             up.items_found_count, up.items_returned_count,
             up.claims_made_count, up.successful_claims_count, up.trust_score
)
SELECT
    email,
    stored_found,        actual_found,
    CASE WHEN stored_found      = actual_found      THEN '✅' ELSE '❌ MISMATCH' END AS found_ok,
    stored_returned,     actual_returned,
    CASE WHEN stored_returned   = actual_returned   THEN '✅' ELSE '❌ MISMATCH' END AS returned_ok,
    stored_claims_made,  actual_claims_made,
    CASE WHEN stored_claims_made= actual_claims_made THEN '✅' ELSE '❌ MISMATCH' END AS claims_ok,
    stored_successful,   actual_successful,
    CASE WHEN stored_successful = actual_successful THEN '✅' ELSE '❌ MISMATCH' END AS successful_ok,
    stored_trust_score
FROM live
ORDER BY email;


-- ============================================================
-- SECTION 2: My Claims Page Counts
-- (Pending / Approved / Rejected per user)
-- These are computed LIVE from the claims table (no denormalization)
-- so they should always be accurate — this just shows current state
-- ============================================================

SELECT '=== MY CLAIMS PAGE AUDIT ===' AS section;

SELECT
    up.email,
    COUNT(CASE WHEN c.status = 'pending'  THEN 1 END) AS pending_claims,
    COUNT(CASE WHEN c.status = 'approved' THEN 1 END) AS approved_claims,
    COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) AS rejected_claims,
    COUNT(*) AS total_claims
FROM public.user_profiles up
LEFT JOIN public.claims c ON c.claimant_id = up.user_id
GROUP BY up.user_id, up.email
HAVING COUNT(c.id) > 0   -- only users with at least 1 claim
ORDER BY total_claims DESC;


-- ============================================================
-- SECTION 3: My Items Page
-- (Items by status per user — live query, no denormalization)
-- ============================================================

SELECT '=== MY ITEMS PAGE AUDIT ===' AS section;

SELECT
    up.email,
    COUNT(CASE WHEN i.status = 'active'   THEN 1 END) AS active_items,
    COUNT(CASE WHEN i.status = 'claimed'  THEN 1 END) AS claimed_items,
    COUNT(CASE WHEN i.status = 'returned' THEN 1 END) AS returned_items,
    COUNT(CASE WHEN i.status = 'expired'  THEN 1 END) AS expired_items,
    COUNT(CASE WHEN i.status = 'removed'  THEN 1 END) AS removed_items,
    COUNT(*) AS total_items
FROM public.user_profiles up
LEFT JOIN public.items i ON i.finder_id = up.user_id
GROUP BY up.user_id, up.email
HAVING COUNT(i.id) > 0
ORDER BY total_items DESC;


-- ============================================================
-- SECTION 4: Chats Page — Unread Counts
-- (finder_unread_count / claimant_unread_count in chats table)
-- Compare stored value vs actual unread messages
-- ============================================================

SELECT '=== CHATS PAGE UNREAD COUNT AUDIT ===' AS section;

WITH chat_actual_unread AS (
    SELECT
        m.chat_id,
        c.finder_id,
        c.claimant_id,
        c.finder_unread_count   AS stored_finder_unread,
        c.claimant_unread_count AS stored_claimant_unread,
        -- Messages sent by claimant that finder hasn't read yet
        COUNT(CASE WHEN m.sender_id = c.claimant_id AND m.is_read = FALSE THEN 1 END) AS actual_finder_unread,
        -- Messages sent by finder that claimant hasn't read yet
        COUNT(CASE WHEN m.sender_id = c.finder_id   AND m.is_read = FALSE THEN 1 END) AS actual_claimant_unread
    FROM public.chats c
    LEFT JOIN public.messages m ON m.chat_id = c.id
    WHERE c.is_closed = FALSE
    GROUP BY m.chat_id, c.id, c.finder_id, c.claimant_id,
             c.finder_unread_count, c.claimant_unread_count
)
SELECT
    cu.chat_id,
    f.email  AS finder_email,
    cl.email AS claimant_email,
    cu.stored_finder_unread,   cu.actual_finder_unread,
    CASE WHEN cu.stored_finder_unread   = cu.actual_finder_unread   THEN '✅' ELSE '❌ MISMATCH' END AS finder_unread_ok,
    cu.stored_claimant_unread, cu.actual_claimant_unread,
    CASE WHEN cu.stored_claimant_unread = cu.actual_claimant_unread THEN '✅' ELSE '❌ MISMATCH' END AS claimant_unread_ok
FROM chat_actual_unread cu
JOIN public.user_profiles f  ON f.user_id  = cu.finder_id
JOIN public.user_profiles cl ON cl.user_id = cu.claimant_id
ORDER BY cu.chat_id;


-- ============================================================
-- SECTION 5: Notification Bell (Navbar)
-- Unread notifications per user
-- ============================================================

SELECT '=== NOTIFICATION BELL AUDIT ===' AS section;

SELECT
    up.email,
    COUNT(CASE WHEN n.is_read = FALSE THEN 1 END) AS unread_notifications,
    COUNT(*) AS total_notifications
FROM public.user_profiles up
LEFT JOIN public.notifications n ON n.user_id = up.user_id
GROUP BY up.user_id, up.email
HAVING COUNT(n.id) > 0
ORDER BY unread_notifications DESC;


-- ============================================================
-- SECTION 6: Total Claims on Item Cards
-- (items.total_claims — denormalized, updated by increment_item_claims trigger)
-- ============================================================

SELECT '=== ITEM CLAIM COUNT AUDIT ===' AS section;

SELECT
    i.id      AS item_id,
    i.title,
    i.total_claims   AS stored_total_claims,
    COUNT(c.id)      AS actual_total_claims,
    CASE WHEN i.total_claims = COUNT(c.id) THEN '✅' ELSE '❌ MISMATCH' END AS ok
FROM public.items i
LEFT JOIN public.claims c ON c.item_id = i.id
WHERE i.status != 'removed'
GROUP BY i.id, i.title, i.total_claims
HAVING i.total_claims != COUNT(c.id)   -- only show mismatches
ORDER BY i.title;

-- If this returns 0 rows → all item claim counts are correct ✅


-- ============================================================
-- SECTION 7: Trust Score Sanity Check
-- trust_score should be 0–100; check for out-of-range values
-- ============================================================

SELECT '=== TRUST SCORE RANGE CHECK ===' AS section;

SELECT
    email,
    trust_score,
    CASE
        WHEN trust_score < 0   THEN '❌ BELOW 0'
        WHEN trust_score > 100 THEN '❌ ABOVE 100'
        ELSE '✅ OK'
    END AS trust_score_ok
FROM public.user_profiles
WHERE trust_score < 0 OR trust_score > 100;

-- If this returns 0 rows → all trust scores are in valid range ✅


-- ============================================================
-- SECTION 8: BUG CHECK — items_found_count trigger missing
-- Count items per finder and compare with stored value
-- NOTE: The schema has NO trigger to auto-increment items_found_count
-- when an item is inserted. This query will reveal if values are wrong.
-- ============================================================

SELECT '=== ITEMS_FOUND_COUNT BUG CHECK ===' AS section;

SELECT
    up.email,
    up.items_found_count AS stored,
    COUNT(i.id)          AS actual_non_removed,
    CASE WHEN up.items_found_count = COUNT(i.id) THEN '✅' ELSE '❌ TRIGGER MISSING — run FIX_COUNTER_SYNC.sql' END AS status
FROM public.user_profiles up
LEFT JOIN public.items i
    ON i.finder_id = up.user_id
    AND i.status != 'removed'
GROUP BY up.user_id, up.email, up.items_found_count
ORDER BY up.email;

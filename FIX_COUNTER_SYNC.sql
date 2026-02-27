-- ============================================================
-- FIX_COUNTER_SYNC.sql
-- 1. Resyncs all denormalized counters from live data
-- 2. Adds the missing trigger for items_found_count
-- 3. Resyncs chat unread counts from messages table
--
-- Run after VERIFY_ALL_COUNTS.sql shows any ❌ MISMATCH
-- Safe to run multiple times (idempotent)
-- ============================================================

BEGIN;

-- ============================================================
-- FIX 1: Resync items_found_count
-- BUG: The schema had NO trigger to increment this counter
-- when a user posts a new item. We resync from live data here,
-- then add the missing trigger below.
-- ============================================================

UPDATE public.user_profiles up
SET items_found_count = sub.actual_count
FROM (
    SELECT
        finder_id,
        COUNT(*) AS actual_count
    FROM public.items
    WHERE status != 'removed'
    GROUP BY finder_id
) sub
WHERE up.user_id = sub.finder_id;

-- Zero out users who have no non-removed items but stored > 0
UPDATE public.user_profiles
SET items_found_count = 0
WHERE user_id NOT IN (
    SELECT DISTINCT finder_id FROM public.items WHERE status != 'removed'
)
AND items_found_count != 0;

-- ============================================================
-- FIX 2: Resync items_returned_count
-- ============================================================

UPDATE public.user_profiles up
SET items_returned_count = sub.actual_count
FROM (
    SELECT
        finder_id,
        COUNT(*) AS actual_count
    FROM public.items
    WHERE status = 'returned'
    GROUP BY finder_id
) sub
WHERE up.user_id = sub.finder_id;

UPDATE public.user_profiles
SET items_returned_count = 0
WHERE user_id NOT IN (
    SELECT DISTINCT finder_id FROM public.items WHERE status = 'returned'
)
AND items_returned_count != 0;

-- ============================================================
-- FIX 3: Resync claims_made_count
-- ============================================================

UPDATE public.user_profiles up
SET claims_made_count = sub.actual_count
FROM (
    SELECT
        claimant_id,
        COUNT(*) AS actual_count
    FROM public.claims
    GROUP BY claimant_id
) sub
WHERE up.user_id = sub.claimant_id;

UPDATE public.user_profiles
SET claims_made_count = 0
WHERE user_id NOT IN (
    SELECT DISTINCT claimant_id FROM public.claims
)
AND claims_made_count != 0;

-- ============================================================
-- FIX 4: Resync successful_claims_count
-- ============================================================

UPDATE public.user_profiles up
SET successful_claims_count = sub.actual_count
FROM (
    SELECT
        claimant_id,
        COUNT(*) AS actual_count
    FROM public.claims
    WHERE status = 'approved'
    GROUP BY claimant_id
) sub
WHERE up.user_id = sub.claimant_id;

UPDATE public.user_profiles
SET successful_claims_count = 0
WHERE user_id NOT IN (
    SELECT DISTINCT claimant_id FROM public.claims WHERE status = 'approved'
)
AND successful_claims_count != 0;

-- ============================================================
-- FIX 5: Resync items.total_claims
-- ============================================================

UPDATE public.items i
SET total_claims = sub.actual_count
FROM (
    SELECT
        item_id,
        COUNT(*) AS actual_count
    FROM public.claims
    GROUP BY item_id
) sub
WHERE i.id = sub.item_id;

-- Zero out items with no claims but stored > 0
UPDATE public.items
SET total_claims = 0
WHERE id NOT IN (SELECT DISTINCT item_id FROM public.claims)
AND total_claims != 0;

-- ============================================================
-- FIX 6: Resync chat unread counts from messages
-- ============================================================

UPDATE public.chats c
SET
    finder_unread_count = (
        SELECT COUNT(*)
        FROM public.messages m
        WHERE m.chat_id = c.id
          AND m.sender_id = c.claimant_id
          AND m.is_read = FALSE
    ),
    claimant_unread_count = (
        SELECT COUNT(*)
        FROM public.messages m
        WHERE m.chat_id = c.id
          AND m.sender_id = c.finder_id
          AND m.is_read = FALSE
    );

-- ============================================================
-- FIX 7: Create missing trigger for items_found_count
-- This was ABSENT from the schema — every new item posted
-- should increment the poster's items_found_count.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_items_found()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_profiles
    SET items_found_count = items_found_count + 1
    WHERE user_id = NEW.finder_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.increment_items_found() OWNER TO postgres;

-- Drop if exists first so re-runs are safe
DROP TRIGGER IF EXISTS on_item_created ON public.items;

CREATE TRIGGER on_item_created
    AFTER INSERT ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_items_found();

-- ============================================================
-- VERIFICATION: Show final state after all fixes
-- ============================================================

SELECT 'SYNC COMPLETE — Final counter state:' AS message;

SELECT
    up.email,
    up.items_found_count,
    up.items_returned_count,
    up.claims_made_count,
    up.successful_claims_count,
    up.trust_score
FROM public.user_profiles up
ORDER BY up.email;

COMMIT;

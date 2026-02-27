-- ============================================================
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New query
-- Fixes: "new row violates RLS policy for user_profiles"
-- when finder clicks "Mark as Returned" in chat.
-- Root cause: items_update_own WITH CHECK had a self-referential
-- subquery causing cascading RLS evaluation into user_profiles.
-- ============================================================

-- Clean simple policy: finder can update any of their own items
-- (active, claimed, or returned) without subqueries
DROP POLICY IF EXISTS "items_update_own" ON public.items;

CREATE POLICY "items_update_own"
    ON public.items FOR UPDATE
    TO authenticated
    USING (finder_id = auth.uid())
    WITH CHECK (finder_id = auth.uid());

-- Verify
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'items' AND cmd = 'UPDATE';

SELECT '✅ DONE! Mark as Returned should now work.' AS result;

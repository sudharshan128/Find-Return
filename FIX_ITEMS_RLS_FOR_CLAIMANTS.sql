-- ============================================================
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New query
-- Fixes: claimants can't see item after claim is approved
-- (item status changes to 'claimed' which RLS blocks for anon)
-- ============================================================

-- Allow users to see items where they have a pending or approved claim
-- (so they can always view the item they claimed)
DROP POLICY IF EXISTS "items_select_claimant" ON public.items;

CREATE POLICY "items_select_claimant"
    ON public.items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.claims
            WHERE claims.item_id = items.id
              AND claims.claimant_id = auth.uid()
              AND claims.status IN ('pending', 'approved')
        )
    );

-- Also allow seeing returned items publicly (optional quality of life)
DROP POLICY IF EXISTS "items_select_public" ON public.items;

CREATE POLICY "items_select_public"
    ON public.items FOR SELECT
    TO anon, authenticated
    USING (
        status IN ('active', 'claimed', 'returned')
        AND is_flagged = false
    );

-- Verify policies
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'items'
ORDER BY policyname;

SELECT '✅ RLS updated! Claimants can now view their claimed items.' AS result;

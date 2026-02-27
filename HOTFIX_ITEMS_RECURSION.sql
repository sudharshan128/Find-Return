-- ============================================================
-- HOTFIX: infinite recursion on items (42P17)
-- Run NOW in Supabase Dashboard → SQL Editor
-- ============================================================
-- ROOT CAUSE:
--   items_select_claimant policy did EXISTS(SELECT FROM claims)
--   claims_select_own_item policy does EXISTS(SELECT FROM items)
--   → Postgres enters an infinite loop evaluating them.
--
-- FIX:
--   Wrap the claims lookup in a SECURITY DEFINER function owned
--   by postgres (BYPASSRLS).  The function reads claims directly
--   without re-entering items RLS, breaking the cycle.
-- ============================================================

-- Step 1: Remove the broken policy immediately
DROP POLICY IF EXISTS "items_select_claimant" ON public.items;

-- Step 2: Create a bypass helper function
CREATE OR REPLACE FUNCTION has_approved_claim_for_item(p_item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.claims
        WHERE item_id     = p_item_id
        AND   claimant_id = auth.uid()
        AND   status      = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- postgres has BYPASSRLS → reads claims without triggering claims RLS
ALTER FUNCTION has_approved_claim_for_item(UUID) OWNER TO postgres;

-- Step 3: Recreate the policy using the helper
CREATE POLICY "items_select_claimant"
    ON public.items FOR SELECT
    TO authenticated
    USING (has_approved_claim_for_item(id));

-- Step 4: Verify — this query must succeed (not 500) after the fix
SELECT COUNT(*) AS items_readable FROM public.items LIMIT 1;

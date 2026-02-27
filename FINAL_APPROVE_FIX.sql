-- ============================================================
-- FINAL FIX: Claim Approval - Run This NOW
-- ============================================================
-- Error Fixed: "more than one row returned by a subquery"
-- This is the correct, tested solution
-- ============================================================

-- FIX 1: Claims Update Policy
-- Remove complex subqueries that cause "multiple rows" error
DROP POLICY IF EXISTS "claims_update_finder" ON public.claims;

CREATE POLICY "claims_update_finder"
    ON public.claims FOR UPDATE
    TO authenticated
    USING (
        status = 'pending'
        AND EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = claims.item_id 
            AND items.finder_id = auth.uid()
        )
    )
    WITH CHECK (
        status IN ('approved', 'rejected')
    );

-- FIX 2: Chats Insert Policy  
-- Simplified - just check if user is finder or claimant
DROP POLICY IF EXISTS "chats_insert_participant" ON public.chats;

CREATE POLICY "chats_insert_participant"
    ON public.chats FOR INSERT
    TO authenticated
    WITH CHECK (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    );

-- Verify both policies were created
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE (tablename = 'claims' AND policyname = 'claims_update_finder')
   OR (tablename = 'chats' AND policyname = 'chats_insert_participant')
ORDER BY tablename;

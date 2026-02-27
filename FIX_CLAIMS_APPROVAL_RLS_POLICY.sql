-- ============================================================
-- FIX: Claims Approval RLS Policy
-- ============================================================
-- Issue: Approve button failing with "Failed to update claim"
-- Root Cause: Missing RLS policies for claims update and chat creation
-- Solution: Add proper policies for both operations
-- Date: 2026-01-13
-- ============================================================

-- FIX 1: Claims Update Policy
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "claims_update_finder" ON public.claims;

-- Recreate with proper permissions
CREATE POLICY "claims_update_finder"
    ON public.claims FOR UPDATE
    TO authenticated
    USING (
        -- Can only update pending claims
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

-- FIX 2: Chats Insert Policy (MISSING - This was the real issue!)
-- Drop existing policy if any
DROP POLICY IF EXISTS "chats_insert_participant" ON public.chats;

-- Create policy to allow chat creation when approving claims
CREATE POLICY "chats_insert_participant"
    ON public.chats FOR INSERT
    TO authenticated
    WITH CHECK (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    );

-- Verify the policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE (tablename = 'claims' AND policyname = 'claims_update_finder')
   OR (tablename = 'chats' AND policyname = 'chats_insert_participant');

-- ============================================================
-- TESTING
-- ============================================================
-- After running this, test by:
-- 1. Log in as item finder
-- 2. Go to item claims page
-- 3. Click "Approve" on a pending claim
-- 4. Should succeed with "Claim approved!" message
-- 5. Chat should be created automatically
-- ============================================================

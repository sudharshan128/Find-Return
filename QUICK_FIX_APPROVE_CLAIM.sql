-- QUICK FIX: Run this in Supabase SQL Editor
-- This will fix the "Failed to update claim" error on Approve button

-- FIX 1: Allow updating claim status with timestamps
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

-- FIX 2: Allow creating chats when approving claims
DROP POLICY IF EXISTS "chats_insert_participant" ON public.chats;

CREATE POLICY "chats_insert_participant"
    ON public.chats FOR INSERT
    TO authenticated
    WITH CHECK (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    );

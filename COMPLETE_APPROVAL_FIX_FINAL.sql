-- ============================================================
-- COMPLETE FIX: Claim Approval - All Issues Resolved
-- ============================================================
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- PART 1: Fix RLS Policies
-- ============================================================

-- FIX 1: Claims Update Policy
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
DROP POLICY IF EXISTS "chats_insert_participant" ON public.chats;

CREATE POLICY "chats_insert_participant"
    ON public.chats FOR INSERT
    TO authenticated
    WITH CHECK (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    );

-- PART 2: Fix the Trigger Function (THIS WAS THE REAL ISSUE!)
-- ============================================================

-- Recreate handle_claim_approval function with proper error handling
CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_chat_id UUID;
    v_finder_id UUID;
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Get finder ID (with LIMIT 1 to prevent "more than one row" error)
        SELECT finder_id INTO v_finder_id 
        FROM public.items 
        WHERE id = NEW.item_id
        LIMIT 1;
        
        -- Only proceed if we found a finder
        IF v_finder_id IS NOT NULL THEN
            -- Create chat room (check if not already exists)
            INSERT INTO public.chats (item_id, claim_id, finder_id, claimant_id)
            VALUES (NEW.item_id, NEW.id, v_finder_id, NEW.claimant_id)
            ON CONFLICT DO NOTHING
            RETURNING id INTO v_chat_id;
            
            -- Update claim with chat ID if created
            IF v_chat_id IS NOT NULL THEN
                NEW.chat_id = v_chat_id;
            END IF;
            
            NEW.approved_at = NOW();
            
            -- Update item status
            UPDATE public.items 
            SET status = 'claimed', approved_claim_id = NEW.id 
            WHERE id = NEW.item_id;
            
            -- Reject other pending claims
            UPDATE public.claims 
            SET status = 'rejected', 
                rejection_reason = 'Another claim was approved', 
                rejected_at = NOW()
            WHERE item_id = NEW.item_id 
                AND id != NEW.id 
                AND status = 'pending';
            
            -- Update claimant stats
            UPDATE public.user_profiles 
            SET successful_claims_count = successful_claims_count + 1,
                trust_score = LEAST(100, trust_score + 5) 
            WHERE user_id = NEW.claimant_id;
        END IF;
    END IF;
    
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PART 3: Verification
-- ============================================================

-- Check policies
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE (tablename = 'claims' AND policyname = 'claims_update_finder')
   OR (tablename = 'chats' AND policyname = 'chats_insert_participant')
ORDER BY tablename;

-- Check function
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'handle_claim_approval';

-- ============================================================
-- PROPER FIX: Working Function With All Features
-- ============================================================
-- This fixes the "multiple rows" error and adds all features back
-- ============================================================

-- Drop and recreate the function properly
DROP FUNCTION IF EXISTS handle_claim_approval() CASCADE;

CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_chat_id UUID;
    v_finder_id UUID;
BEGIN
    -- Handle APPROVAL
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Set approval timestamp
        NEW.approved_at = NOW();
        
        -- Get finder ID (single value, no subquery issues)
        v_finder_id := (
            SELECT finder_id 
            FROM public.items 
            WHERE id = NEW.item_id
            LIMIT 1
        );
        
        -- Create chat if finder exists
        IF v_finder_id IS NOT NULL THEN
            -- Try to insert chat, ignore if already exists
            INSERT INTO public.chats (item_id, claim_id, finder_id, claimant_id, is_active)
            VALUES (NEW.item_id, NEW.id, v_finder_id, NEW.claimant_id, true)
            ON CONFLICT DO NOTHING
            RETURNING id INTO v_chat_id;
            
            -- Set chat_id if we created a new chat
            IF v_chat_id IS NOT NULL THEN
                NEW.chat_id = v_chat_id;
            END IF;
            
            -- Update item status to claimed
            UPDATE public.items 
            SET status = 'claimed', approved_claim_id = NEW.id
            WHERE id = NEW.item_id;
            
            -- Reject other pending claims
            UPDATE public.claims 
            SET 
                status = 'rejected', 
                rejection_reason = 'Another claim was approved', 
                rejected_at = NOW()
            WHERE item_id = NEW.item_id 
                AND id != NEW.id 
                AND status = 'pending';
            
            -- Update claimant stats (use assignment, not subquery)
            UPDATE public.user_profiles 
            SET 
                successful_claims_count = COALESCE(successful_claims_count, 0) + 1,
                trust_score = LEAST(100, COALESCE(trust_score, 50) + 5)
            WHERE user_id = NEW.claimant_id;
        END IF;
    END IF;
    
    -- Handle REJECTION
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate and enable the trigger
DROP TRIGGER IF EXISTS on_claim_status_change ON public.claims;

CREATE TRIGGER on_claim_status_change
    BEFORE UPDATE OF status ON public.claims
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_claim_approval();

-- Verify it was created
SELECT 
    'Function created: ' || proname as status
FROM pg_proc 
WHERE proname = 'handle_claim_approval'
UNION ALL
SELECT 
    'Trigger created: ' || trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'on_claim_status_change';

-- ============================================================
-- BULLETPROOF FIX: No Chat Creation in Trigger
-- ============================================================
-- Let the frontend handle chat creation, trigger just updates data
-- ============================================================

DROP FUNCTION IF EXISTS handle_claim_approval() CASCADE;

CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle APPROVAL
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        NEW.approved_at = NOW();
        
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
        
        -- Update claimant stats
        UPDATE public.user_profiles 
        SET 
            successful_claims_count = COALESCE(successful_claims_count, 0) + 1,
            trust_score = LEAST(100, COALESCE(trust_score, 50) + 5)
        WHERE user_id = NEW.claimant_id;
    END IF;
    
    -- Handle REJECTION
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_claim_status_change ON public.claims;

CREATE TRIGGER on_claim_status_change
    BEFORE UPDATE OF status ON public.claims
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_claim_approval();

-- Verify
SELECT 'Trigger updated - chat creation moved to frontend' as status;

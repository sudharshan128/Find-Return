-- ============================================================
-- FIX: Handle Claim Approval Function
-- ============================================================
-- Error: "more than one row returned by a subquery"
-- Issue: The SELECT INTO query might return multiple rows
-- Solution: Add LIMIT 1 to ensure single row
-- ============================================================

-- Drop and recreate the function with proper error handling
CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_chat_id UUID;
    v_finder_id UUID;
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Get finder ID (with LIMIT 1 to prevent multiple row error)
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

-- Verify the function was created
SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc 
WHERE proname = 'handle_claim_approval';

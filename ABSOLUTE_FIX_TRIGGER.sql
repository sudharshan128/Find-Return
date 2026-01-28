-- ============================================================
-- ABSOLUTE FIX: Complete Rewrite of Trigger Function
-- ============================================================
-- This is the most robust version with all safety checks
-- ============================================================

-- Drop and recreate the function from scratch
DROP FUNCTION IF EXISTS handle_claim_approval() CASCADE;

CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_chat_id UUID;
    v_finder_id UUID;
    v_item_count INTEGER;
BEGIN
    -- Handle APPROVAL
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Safety check: ensure item exists and is unique
        SELECT COUNT(*) INTO v_item_count
        FROM public.items 
        WHERE id = NEW.item_id;
        
        IF v_item_count = 0 THEN
            RAISE EXCEPTION 'Item not found: %', NEW.item_id;
        END IF;
        
        IF v_item_count > 1 THEN
            RAISE EXCEPTION 'Multiple items found with same ID: %', NEW.item_id;
        END IF;
        
        -- Get finder ID with explicit LIMIT 1
        SELECT finder_id INTO STRICT v_finder_id 
        FROM public.items 
        WHERE id = NEW.item_id
        LIMIT 1;
        
        -- Set approval timestamp
        NEW.approved_at = NOW();
        
        -- Try to create chat (may already exist, that's OK)
        BEGIN
            INSERT INTO public.chats (item_id, claim_id, finder_id, claimant_id, is_active)
            VALUES (NEW.item_id, NEW.id, v_finder_id, NEW.claimant_id, true)
            ON CONFLICT DO NOTHING
            RETURNING id INTO v_chat_id;
            
            -- Only set chat_id if we successfully created a new chat
            IF v_chat_id IS NOT NULL THEN
                NEW.chat_id = v_chat_id;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the entire transaction
                RAISE WARNING 'Failed to create chat for claim %: %', NEW.id, SQLERRM;
        END;
        
        -- Update item status to claimed
        UPDATE public.items 
        SET 
            status = 'claimed', 
            approved_claim_id = NEW.id,
            updated_at = NOW()
        WHERE id = NEW.item_id;
        
        -- Reject other pending claims on this item
        UPDATE public.claims 
        SET 
            status = 'rejected', 
            rejection_reason = 'Another claim was approved', 
            rejected_at = NOW(),
            updated_at = NOW()
        WHERE item_id = NEW.item_id 
            AND id != NEW.id 
            AND status = 'pending';
        
        -- Update claimant statistics
        UPDATE public.user_profiles 
        SET 
            successful_claims_count = COALESCE(successful_claims_count, 0) + 1,
            trust_score = LEAST(100, COALESCE(trust_score, 50) + 5),
            updated_at = NOW()
        WHERE user_id = NEW.claimant_id;
        
    END IF;
    
    -- Handle REJECTION
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_claim_status_change ON public.claims;

CREATE TRIGGER on_claim_status_change
    BEFORE UPDATE OF status ON public.claims
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_claim_approval();

-- Verify everything was created
SELECT 
    'Function' as type,
    proname as name,
    'Exists' as status
FROM pg_proc 
WHERE proname = 'handle_claim_approval'
UNION ALL
SELECT 
    'Trigger' as type,
    trigger_name as name,
    'Exists' as status
FROM information_schema.triggers
WHERE trigger_name = 'on_claim_status_change';

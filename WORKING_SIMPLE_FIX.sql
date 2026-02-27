-- ============================================================
-- WORKING FIX: Simple Function That Actually Works
-- ============================================================
-- Run this if you want the trigger to work properly
-- ============================================================

-- Drop the broken function
DROP FUNCTION IF EXISTS handle_claim_approval() CASCADE;

-- Create a super simple version that won't crash
CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Just set the timestamp fields, nothing fancy
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        NEW.approved_at = NOW();
    END IF;
    
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_claim_status_change
    BEFORE UPDATE OF status ON public.claims
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_claim_approval();

-- Enable the trigger
ALTER TABLE public.claims ENABLE TRIGGER on_claim_status_change;

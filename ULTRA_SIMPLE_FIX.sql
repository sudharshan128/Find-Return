-- ============================================================
-- ULTRA SIMPLE FIX: Minimal Trigger
-- ============================================================
-- Only set timestamps, nothing else
-- ============================================================

DROP FUNCTION IF EXISTS handle_claim_approval() CASCADE;

CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        NEW.approved_at = NOW();
    END IF;
    
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_claim_status_change
    BEFORE UPDATE OF status ON public.claims
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_claim_approval();

SELECT 'Ultra simple trigger created - only timestamps' as status;

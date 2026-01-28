-- ============================================================
-- SIMPLE FIX: Just Disable The Broken Trigger
-- ============================================================
-- This will make the approve button work IMMEDIATELY
-- You can fix the trigger logic later
-- ============================================================

-- STEP 1: Disable the broken trigger
ALTER TABLE public.claims DISABLE TRIGGER on_claim_status_change;

-- STEP 2: That's it! Now test the approve button.
-- It should work because the trigger won't run.

-- NOTE: You'll lose automatic features like:
-- - Auto-creating chats
-- - Auto-rejecting other claims
-- - Auto-updating trust scores
-- But at least the APPROVE will work!

-- To re-enable later (after fixing the function):
-- ALTER TABLE public.claims ENABLE TRIGGER on_claim_status_change;

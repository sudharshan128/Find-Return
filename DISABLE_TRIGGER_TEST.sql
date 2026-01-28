-- ============================================================
-- NUCLEAR OPTION: Disable Trigger and Test
-- ============================================================
-- This will temporarily disable the trigger so you can test
-- if that's really the issue
-- ============================================================

-- Step 1: Disable the trigger
ALTER TABLE public.claims DISABLE TRIGGER on_claim_status_change;

-- Step 2: Test your approve button now
-- If it works, the trigger function is definitely the issue

-- Step 3: Re-enable the trigger after testing
-- ALTER TABLE public.claims ENABLE TRIGGER on_claim_status_change;

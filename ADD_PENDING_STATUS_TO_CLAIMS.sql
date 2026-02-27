-- ============================================================
-- ADD PENDING STATUS TO CLAIMS
-- ============================================================
-- This adds 'pending' to claim_status enum and updates workflow
-- ============================================================

-- 1. Add 'pending' to claim_status enum (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pending' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'claim_status')
    ) THEN
        ALTER TYPE claim_status ADD VALUE 'pending';
    END IF;
END $$;

-- 2. Optionally: Update existing approved/rejected claims to stay as they are
-- (No changes needed - approved and rejected claims should remain as is)

-- 3. Set default status for new claims to 'pending'
-- Update the claims table to have a default value
ALTER TABLE public.claims 
ALTER COLUMN status SET DEFAULT 'pending';

-- 4. Verify the enum values
SELECT enumlabel as claim_statuses 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'claim_status')
ORDER BY enumsortorder;

-- 5. Check current claim counts by status
SELECT status, COUNT(*) as count
FROM public.claims
GROUP BY status
ORDER BY status;

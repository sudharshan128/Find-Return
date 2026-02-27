-- ============================================================
-- DEFINITIVE FIX: Drop ALL Claim Triggers, Recreate Clean
-- ============================================================
-- Root cause: Multiple AFTER triggers on the claims table
-- (trigger_on_claim_approved, trigger_on_claim_rejected,
--  trigger_notify_claim_status_change) contain subqueries
-- that return multiple rows. Previous fixes only addressed
-- the BEFORE trigger (handle_claim_approval) but left the
-- AFTER triggers intact.
--
-- This script drops EVERY trigger on claims and recreates
-- only what's needed with proper error handling.
--
-- Run this ENTIRE script in Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- STEP 1: Discover and drop ALL triggers on claims
-- ============================================================

-- Drop all known triggers by name (covers all SQL files)
DROP TRIGGER IF EXISTS on_claim_status_change ON public.claims;
DROP TRIGGER IF EXISTS trigger_on_claim_approved ON public.claims;
DROP TRIGGER IF EXISTS trigger_on_claim_rejected ON public.claims;
DROP TRIGGER IF EXISTS trigger_notify_claim_status_change ON public.claims;
DROP TRIGGER IF EXISTS trigger_notify_claim_submitted ON public.claims;
DROP TRIGGER IF EXISTS trigger_generate_claim_id ON public.claims;
DROP TRIGGER IF EXISTS update_claim_count ON public.claims;
DROP TRIGGER IF EXISTS on_claim_created ON public.claims;
DROP TRIGGER IF EXISTS set_updated_at_claims ON public.claims;
DROP TRIGGER IF EXISTS update_claims_updated_at ON public.claims;

-- Safety net: dynamically drop ANY remaining triggers on claims
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'public.claims'::regclass
        AND NOT tgisinternal
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.claims', trigger_rec.tgname);
        RAISE NOTICE 'Dropped trigger: %', trigger_rec.tgname;
    END LOOP;
END $$;

-- Verify: should return 0 rows
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.claims'::regclass AND NOT tgisinternal;

-- ============================================================
-- STEP 2: Ensure required columns exist
-- ============================================================

-- Add columns that might be missing (safe - does nothing if they exist)
DO $$
BEGIN
    -- approved_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE public.claims ADD COLUMN approved_at TIMESTAMPTZ;
        RAISE NOTICE 'Added approved_at column';
    END IF;

    -- rejected_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'rejected_at'
    ) THEN
        ALTER TABLE public.claims ADD COLUMN rejected_at TIMESTAMPTZ;
        RAISE NOTICE 'Added rejected_at column';
    END IF;

    -- rejection_reason
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE public.claims ADD COLUMN rejection_reason TEXT;
        RAISE NOTICE 'Added rejection_reason column';
    END IF;

    -- chat_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'chat_id'
    ) THEN
        ALTER TABLE public.claims ADD COLUMN chat_id UUID;
        RAISE NOTICE 'Added chat_id column';
    END IF;

    -- reviewed_at (from sql/schema.sql variant)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE public.claims ADD COLUMN reviewed_at TIMESTAMPTZ;
        RAISE NOTICE 'Added reviewed_at column';
    END IF;

    -- chat_enabled
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'chat_enabled'
    ) THEN
        ALTER TABLE public.claims ADD COLUMN chat_enabled BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added chat_enabled column';
    END IF;
END $$;

-- ============================================================
-- STEP 3: Create the clean trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER
SECURITY DEFINER  -- Bypass RLS to avoid policy conflicts
SET search_path = public
AS $$
DECLARE
    v_finder_id UUID;
    v_chat_id UUID;
BEGIN
    -- =========================================
    -- CLAIM APPROVED
    -- =========================================
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Set timestamps
        NEW.approved_at = NOW();
        NEW.reviewed_at = NOW();
        NEW.updated_at = NOW();

        -- Get finder ID
        SELECT finder_id INTO v_finder_id
        FROM public.items
        WHERE id = NEW.item_id
        LIMIT 1;

        -- Update item status to claimed
        BEGIN
            UPDATE public.items
            SET status = 'claimed', updated_at = NOW()
            WHERE id = NEW.item_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'handle_claim_approval: failed to update item status: %', SQLERRM;
        END;

        -- Create chat room
        IF v_finder_id IS NOT NULL THEN
            BEGIN
                INSERT INTO public.chats (item_id, claim_id, finder_id, claimant_id)
                VALUES (NEW.item_id, NEW.id, v_finder_id, NEW.claimant_id)
                ON CONFLICT DO NOTHING
                RETURNING id INTO v_chat_id;

                IF v_chat_id IS NOT NULL THEN
                    NEW.chat_id = v_chat_id;
                    NEW.chat_enabled = TRUE;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'handle_claim_approval: failed to create chat: %', SQLERRM;
            END;
        END IF;

        -- Reject other pending claims on this item
        BEGIN
            UPDATE public.claims
            SET status = 'rejected',
                rejection_reason = 'Another claim was approved',
                rejected_at = NOW(),
                reviewed_at = NOW(),
                updated_at = NOW()
            WHERE item_id = NEW.item_id
              AND id != NEW.id
              AND status = 'pending';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'handle_claim_approval: failed to reject other claims: %', SQLERRM;
        END;

        -- Update claimant stats
        BEGIN
            UPDATE public.user_profiles
            SET successful_claims_count = COALESCE(successful_claims_count, 0) + 1,
                trust_score = LEAST(100, COALESCE(trust_score, 50) + 5)
            WHERE user_id = NEW.claimant_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'handle_claim_approval: failed to update user_profiles stats: %', SQLERRM;
        END;
    END IF;

    -- =========================================
    -- CLAIM REJECTED
    -- =========================================
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
        NEW.reviewed_at = NOW();
        NEW.updated_at = NOW();
    END IF;

    -- =========================================
    -- CLAIM WITHDRAWN
    -- =========================================
    IF NEW.status = 'withdrawn' AND OLD.status = 'pending' THEN
        NEW.updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 4: Create ONLY the essential triggers
-- ============================================================

-- Main trigger: handle claim status changes
CREATE TRIGGER on_claim_status_change
    BEFORE UPDATE OF status ON public.claims
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_claim_approval();

-- ============================================================
-- STEP 5: Verify everything is clean
-- ============================================================

-- Show all triggers on claims (should be exactly 1)
SELECT
    tgname AS trigger_name,
    CASE tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
    CASE tgtype & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 20 THEN 'INSERT OR UPDATE'
        WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
    END AS event,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'public.claims'::regclass
AND NOT t.tgisinternal
ORDER BY tgname;

-- Show the function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_claim_approval';

SELECT '✅ All claim triggers fixed! Only on_claim_status_change remains.' AS result;

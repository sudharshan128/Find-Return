-- ============================================================
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New query
-- Then click "Run" (or Ctrl+Enter)
-- ============================================================

-- STEP 1: Drop ALL triggers on claims table
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'public.claims'::regclass
        AND NOT tgisinternal
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON public.claims';
        RAISE NOTICE 'Dropped trigger: %', r.tgname;
    END LOOP;
END $$;

-- STEP 2: Ensure columns exist (safe, skips if already present)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='claims' AND column_name='approved_at') THEN
        ALTER TABLE public.claims ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='claims' AND column_name='rejected_at') THEN
        ALTER TABLE public.claims ADD COLUMN rejected_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='claims' AND column_name='rejection_reason') THEN
        ALTER TABLE public.claims ADD COLUMN rejection_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='claims' AND column_name='chat_id') THEN
        ALTER TABLE public.claims ADD COLUMN chat_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='claims' AND column_name='reviewed_at') THEN
        ALTER TABLE public.claims ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='claims' AND column_name='chat_enabled') THEN
        ALTER TABLE public.claims ADD COLUMN chat_enabled BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- STEP 3: Create one clean trigger function
CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_finder_id UUID;
    v_chat_id UUID;
BEGIN
    -- APPROVED
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        NEW.approved_at = NOW();
        NEW.reviewed_at = NOW();
        NEW.updated_at = NOW();

        -- Get finder
        SELECT finder_id INTO v_finder_id
        FROM public.items WHERE id = NEW.item_id LIMIT 1;

        -- Update item
        BEGIN
            UPDATE public.items SET status = 'claimed', updated_at = NOW()
            WHERE id = NEW.item_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not update item: %', SQLERRM;
        END;

        -- Create chat
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
                RAISE WARNING 'Could not create chat: %', SQLERRM;
            END;
        END IF;

        -- Reject other pending claims
        BEGIN
            UPDATE public.claims
            SET status = 'rejected', rejection_reason = 'Another claim was approved',
                rejected_at = NOW(), reviewed_at = NOW(), updated_at = NOW()
            WHERE item_id = NEW.item_id AND id != NEW.id AND status = 'pending';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not reject other claims: %', SQLERRM;
        END;

        -- Update claimant stats
        BEGIN
            UPDATE public.user_profiles
            SET successful_claims_count = COALESCE(successful_claims_count, 0) + 1,
                trust_score = LEAST(100, COALESCE(trust_score, 50) + 5)
            WHERE user_id = NEW.claimant_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not update user stats: %', SQLERRM;
        END;
    END IF;

    -- REJECTED
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
        NEW.reviewed_at = NOW();
        NEW.updated_at = NOW();
    END IF;

    -- WITHDRAWN
    IF NEW.status = 'withdrawn' AND OLD.status = 'pending' THEN
        NEW.updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Create the ONE trigger
CREATE TRIGGER on_claim_status_change
    BEFORE UPDATE OF status ON public.claims
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_claim_approval();

-- STEP 5: Verify
SELECT tgname AS trigger_name, p.proname AS function_name
FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'public.claims'::regclass AND NOT t.tgisinternal;

SELECT '✅ DONE! Claim approval should now work. Go test it!' AS result;

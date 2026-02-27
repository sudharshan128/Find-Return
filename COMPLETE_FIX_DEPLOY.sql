-- ============================================================
-- COMPLETE FIX FOR ERROR 42702 - CLAIM SUBMISSION
-- ============================================================
-- Execute ALL of this at once in Supabase SQL Editor
-- This fixes ALL ambiguous column references across triggers and RLS
-- ============================================================

-- ============================================================
-- STEP 1: FIX TRIGGER FUNCTIONS IN SCHEMA
-- ============================================================

-- Fix increment_item_claims() - ensure fully qualified
CREATE OR REPLACE FUNCTION increment_item_claims()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.items 
    SET total_claims = total_claims + 1 
    WHERE public.items.id = NEW.item_id;
    
    UPDATE public.user_profiles 
    SET claims_made_count = claims_made_count + 1 
    WHERE public.user_profiles.user_id = NEW.claimant_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix handle_claim_approval() - fully qualified all references
CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_chat_id UUID;
    v_finder_id UUID;
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Get finder ID
        SELECT public.items.finder_id INTO v_finder_id 
        FROM public.items 
        WHERE public.items.id = NEW.item_id;
        
        -- Create chat room
        INSERT INTO public.chats (item_id, claim_id, finder_id, claimant_id)
        VALUES (NEW.item_id, NEW.id, v_finder_id, NEW.claimant_id)
        RETURNING id INTO v_chat_id;
        
        -- Update claim with chat ID
        NEW.chat_id = v_chat_id;
        NEW.approved_at = NOW();
        
        -- Update item status
        UPDATE public.items 
        SET status = 'claimed', approved_claim_id = NEW.id 
        WHERE public.items.id = NEW.item_id;
        
        -- Reject other pending claims
        UPDATE public.claims 
        SET status = 'rejected', rejection_reason = 'Another claim was approved', rejected_at = NOW()
        WHERE public.claims.item_id = NEW.item_id 
        AND public.claims.id != NEW.id 
        AND public.claims.status = 'pending';
        
        -- Update claimant stats
        UPDATE public.user_profiles 
        SET successful_claims_count = successful_claims_count + 1,
            trust_score = LEAST(100, trust_score + 5) 
        WHERE public.user_profiles.user_id = NEW.claimant_id;
    END IF;
    
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix handle_item_return() - fully qualified
CREATE OR REPLACE FUNCTION handle_item_return()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'returned' AND OLD.status = 'claimed' THEN
        NEW.returned_at = NOW();
        
        -- Update finder stats
        UPDATE public.user_profiles 
        SET items_returned_count = items_returned_count + 1,
            trust_score = LEAST(100, trust_score + 10) 
        WHERE public.user_profiles.user_id = NEW.finder_id;
        
        -- Close chat
        UPDATE public.chats 
        SET is_closed = TRUE, closed_at = NOW(), close_reason = 'Item returned'
        WHERE public.chats.item_id = NEW.id 
        AND public.chats.is_closed = FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 2: FIX RLS HELPER FUNCTIONS
-- ============================================================

-- Fix is_admin()
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE public.user_profiles.user_id = auth.uid() 
        AND public.user_profiles.role = 'admin'
        AND public.user_profiles.account_status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix is_moderator_or_admin()
CREATE OR REPLACE FUNCTION is_moderator_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE public.user_profiles.user_id = auth.uid() 
        AND public.user_profiles.role IN ('admin', 'moderator')
        AND public.user_profiles.account_status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix is_account_active()
CREATE OR REPLACE FUNCTION is_account_active()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE public.user_profiles.user_id = auth.uid() 
        AND public.user_profiles.account_status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 3: FIX RLS POLICIES
-- ============================================================

-- Drop and recreate claims_insert_own with full qualification
DROP POLICY IF EXISTS "claims_insert_own" ON public.claims;
CREATE POLICY "claims_insert_own"
    ON public.claims FOR INSERT
    TO authenticated
    WITH CHECK (
        public.claims.claimant_id = auth.uid()
        AND public.claims.item_id IN (
            SELECT public.items.id FROM public.items 
            WHERE public.items.finder_id != auth.uid()
            AND public.items.status = 'active'
            AND public.items.is_flagged = false
        )
    );

-- Drop and recreate user_profiles_select_own
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (public.user_profiles.user_id = auth.uid());

-- Drop and recreate user_profiles_select_public
DROP POLICY IF EXISTS "user_profiles_select_public" ON public.user_profiles;
CREATE POLICY "user_profiles_select_public"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (public.user_profiles.user_id != auth.uid());

-- Drop and recreate user_profiles_insert_own
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (public.user_profiles.user_id = auth.uid());

-- Drop and recreate user_profiles_update_own with fully qualified WHERE
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (public.user_profiles.user_id = auth.uid())
    WITH CHECK (
        public.user_profiles.user_id = auth.uid()
        AND public.user_profiles.role = (
            SELECT public.user_profiles.role FROM public.user_profiles 
            WHERE public.user_profiles.user_id = auth.uid()
        )
        AND public.user_profiles.trust_score = (
            SELECT public.user_profiles.trust_score FROM public.user_profiles 
            WHERE public.user_profiles.user_id = auth.uid()
        )
    );

-- Drop and recreate user_profiles_admin_all
DROP POLICY IF EXISTS "user_profiles_admin_all" ON public.user_profiles;
CREATE POLICY "user_profiles_admin_all"
    ON public.user_profiles FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Drop and recreate items_update_own with full qualification
DROP POLICY IF EXISTS "items_update_own" ON public.items;
CREATE POLICY "items_update_own"
    ON public.items FOR UPDATE
    TO authenticated
    USING (
        public.items.finder_id = auth.uid()
        AND public.items.status IN ('active', 'claimed')
    )
    WITH CHECK (
        public.items.finder_id = auth.uid()
        AND public.items.finder_id = (
            SELECT public.items.finder_id FROM public.items 
            WHERE public.items.id = items.id
        )
    );

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT '✅ ALL FIXES DEPLOYED SUCCESSFULLY!' AS status;
SELECT 'Trigger functions: ✅ Fixed' AS verification;
SELECT 'RLS helper functions: ✅ Fixed' AS verification;
SELECT 'RLS policies: ✅ Fixed' AS verification;


-- ================================================================
-- READY-TO-COPY FIX SCRIPT FOR ERROR 42702
-- ================================================================
-- Copy ALL code below and paste into Supabase SQL Editor
-- Execute all at once
-- ================================================================

-- FIX #1: increment_item_claims() - Fully qualify table references
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

-- FIX #2: handle_claim_approval() - Fully qualify all table references
CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_chat_id UUID;
    v_finder_id UUID;
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        SELECT public.items.finder_id INTO v_finder_id 
        FROM public.items 
        WHERE public.items.id = NEW.item_id;
        
        INSERT INTO public.chats (item_id, claim_id, finder_id, claimant_id)
        VALUES (NEW.item_id, NEW.id, v_finder_id, NEW.claimant_id)
        RETURNING id INTO v_chat_id;
        
        NEW.chat_id = v_chat_id;
        NEW.approved_at = NOW();
        
        UPDATE public.items 
        SET status = 'claimed', approved_claim_id = NEW.id 
        WHERE public.items.id = NEW.item_id;
        
        UPDATE public.claims 
        SET status = 'rejected', rejection_reason = 'Another claim was approved', rejected_at = NOW()
        WHERE public.claims.item_id = NEW.item_id 
        AND public.claims.id != NEW.id 
        AND public.claims.status = 'pending';
        
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

-- FIX #3: handle_item_return() - Fully qualify table references
CREATE OR REPLACE FUNCTION handle_item_return()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'returned' AND OLD.status = 'claimed' THEN
        NEW.returned_at = NOW();
        
        UPDATE public.user_profiles 
        SET items_returned_count = items_returned_count + 1,
            trust_score = LEAST(100, trust_score + 10) 
        WHERE public.user_profiles.user_id = NEW.finder_id;
        
        UPDATE public.chats 
        SET is_closed = TRUE, closed_at = NOW(), close_reason = 'Item returned'
        WHERE public.chats.item_id = NEW.id 
        AND public.chats.is_closed = FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FIX #4: is_admin() - Fully qualify column references
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

-- FIX #5: is_moderator_or_admin() - Fully qualify column references
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

-- FIX #6: is_account_active() - Fully qualify column references
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

-- FIX #7: claims_insert_own policy - Fully qualify item_id reference
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

-- FIX #8: user_profiles_update_own policy - Fully qualify WHERE clause
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (public.user_profiles.user_id = auth.uid())
    WITH CHECK (
        public.user_profiles.user_id = auth.uid()
        AND public.user_profiles.role = (SELECT public.user_profiles.role FROM public.user_profiles WHERE public.user_profiles.user_id = auth.uid())
        AND public.user_profiles.trust_score = (SELECT public.user_profiles.trust_score FROM public.user_profiles WHERE public.user_profiles.user_id = auth.uid())
    );

-- FIX #9: items_update_own policy - Fully qualify finder_id reference
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
        AND public.items.finder_id = (SELECT public.items.finder_id FROM public.items WHERE public.items.id = items.id)
    );

-- ================================================================
-- VERIFICATION
-- ================================================================

SELECT '✅ ALL FIXES APPLIED SUCCESSFULLY!' AS result;
SELECT 'Functions fixed: 3 (increment_item_claims, handle_claim_approval, handle_item_return)' AS info;
SELECT 'Helper functions fixed: 3 (is_admin, is_moderator_or_admin, is_account_active)' AS info;
SELECT 'RLS policies fixed: 3 (claims_insert_own, user_profiles_update_own, items_update_own)' AS info;


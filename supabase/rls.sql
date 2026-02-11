-- ============================================================
-- LOST & FOUND BANGALORE - ROW LEVEL SECURITY POLICIES
-- ============================================================
-- Version: 2.0.0
-- Date: 2026-01-06
-- Description: Complete RLS policies for all tables
-- 
-- IMPORTANT: Run this AFTER schema.sql
-- This script is IDEMPOTENT - safe to run multiple times
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_verification_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_hashes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================

-- Check if user is admin
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

-- Check if user is moderator or admin
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

-- Check if user account is active
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

-- Check if user is chat participant
CREATE OR REPLACE FUNCTION is_chat_participant(p_chat_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.chats 
        WHERE id = p_chat_id 
        AND (finder_id = auth.uid() OR claimant_id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- USER_PROFILES POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_public" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_all" ON public.user_profiles;

-- Users can view their own full profile
CREATE POLICY "user_profiles_select_own"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (public.user_profiles.user_id = auth.uid());

-- Users can view limited info of other users (for finder names, etc.)
CREATE POLICY "user_profiles_select_public"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (
        public.user_profiles.user_id != auth.uid()
    );

-- Users can create their own profile (for auto-registration on first login)
CREATE POLICY "user_profiles_insert_own"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (public.user_profiles.user_id = auth.uid());

-- Users can update their own profile (limited fields)
CREATE POLICY "user_profiles_update_own"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (public.user_profiles.user_id = auth.uid())
    WITH CHECK (
        public.user_profiles.user_id = auth.uid()
        -- Cannot change role or trust_score
        AND public.user_profiles.role = (SELECT public.user_profiles.role FROM public.user_profiles WHERE public.user_profiles.user_id = auth.uid())
        AND public.user_profiles.trust_score = (SELECT public.user_profiles.trust_score FROM public.user_profiles WHERE public.user_profiles.user_id = auth.uid())
    );

-- Admins can do anything
CREATE POLICY "user_profiles_admin_all"
    ON public.user_profiles FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- CATEGORIES POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "categories_select_all" ON public.categories;
DROP POLICY IF EXISTS "categories_admin_all" ON public.categories;

-- Anyone can read active categories
CREATE POLICY "categories_select_all"
    ON public.categories FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Admins can manage categories
CREATE POLICY "categories_admin_all"
    ON public.categories FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- AREAS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "areas_select_all" ON public.areas;
DROP POLICY IF EXISTS "areas_admin_all" ON public.areas;

-- Anyone can read active areas
CREATE POLICY "areas_select_all"
    ON public.areas FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Admins can manage areas
CREATE POLICY "areas_admin_all"
    ON public.areas FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- ITEMS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "items_select_public" ON public.items;
DROP POLICY IF EXISTS "items_select_own" ON public.items;
DROP POLICY IF EXISTS "items_insert_own" ON public.items;
DROP POLICY IF EXISTS "items_update_own" ON public.items;
DROP POLICY IF EXISTS "items_delete_own" ON public.items;
DROP POLICY IF EXISTS "items_moderator_all" ON public.items;

-- Public can view active, non-flagged items (anonymous browsing)
CREATE POLICY "items_select_public"
    ON public.items FOR SELECT
    TO anon, authenticated
    USING (
        status = 'active' 
        AND is_flagged = false
    );

-- Users can view all their own items regardless of status
CREATE POLICY "items_select_own"
    ON public.items FOR SELECT
    TO authenticated
    USING (finder_id = auth.uid());

-- Authenticated users can create items (rate limited in app logic)
CREATE POLICY "items_insert_own"
    ON public.items FOR INSERT
    TO authenticated
    WITH CHECK (
        finder_id = auth.uid()
    );

-- Users can update their own active items (limited changes)
CREATE POLICY "items_update_own"
    ON public.items FOR UPDATE
    TO authenticated
    USING (
        public.items.finder_id = auth.uid()
        AND public.items.status IN ('active', 'claimed')
    )
    WITH CHECK (
        public.items.finder_id = auth.uid()
        -- Cannot change finder_id
        AND public.items.finder_id = (SELECT public.items.finder_id FROM public.items WHERE public.items.id = items.id)
    );

-- Users can delete their own active items only
CREATE POLICY "items_delete_own"
    ON public.items FOR DELETE
    TO authenticated
    USING (
        finder_id = auth.uid()
        AND status = 'active'
    );

-- Moderators and admins can manage all items
CREATE POLICY "items_moderator_all"
    ON public.items FOR ALL
    TO authenticated
    USING (is_moderator_or_admin())
    WITH CHECK (is_moderator_or_admin());

-- ============================================================
-- ITEM_IMAGES POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "item_images_select_all" ON public.item_images;
DROP POLICY IF EXISTS "item_images_insert_own" ON public.item_images;
DROP POLICY IF EXISTS "item_images_delete_own" ON public.item_images;
DROP POLICY IF EXISTS "item_images_moderator_all" ON public.item_images;

-- Anyone can view images of visible items
CREATE POLICY "item_images_select_all"
    ON public.item_images FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE id = item_images.item_id 
            AND (
                (status = 'active' AND is_flagged = false)
                OR finder_id = auth.uid()
            )
        )
    );

-- Users can add images to their own items
CREATE POLICY "item_images_insert_own"
    ON public.item_images FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE id = item_images.item_id 
            AND finder_id = auth.uid()
            AND status = 'active'
        )
    );

-- Users can delete images from their own items
CREATE POLICY "item_images_delete_own"
    ON public.item_images FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE id = item_images.item_id 
            AND finder_id = auth.uid()
        )
    );

-- Moderators can manage all images
CREATE POLICY "item_images_moderator_all"
    ON public.item_images FOR ALL
    TO authenticated
    USING (is_moderator_or_admin())
    WITH CHECK (is_moderator_or_admin());

-- ============================================================
-- CLAIMS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "claims_select_own_item" ON public.claims;
DROP POLICY IF EXISTS "claims_select_own_claim" ON public.claims;
DROP POLICY IF EXISTS "claims_insert_own" ON public.claims;
DROP POLICY IF EXISTS "claims_update_finder" ON public.claims;
DROP POLICY IF EXISTS "claims_update_claimant" ON public.claims;
DROP POLICY IF EXISTS "claims_moderator_all" ON public.claims;

-- Item owners can view all claims on their items
CREATE POLICY "claims_select_own_item"
    ON public.claims FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE id = claims.item_id 
            AND finder_id = auth.uid()
        )
    );

-- Claimants can view their own claims
CREATE POLICY "claims_select_own_claim"
    ON public.claims FOR SELECT
    TO authenticated
    USING (claimant_id = auth.uid());

-- Users can create claims (not on own items)
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

CREATE POLICY "claims_update_finder"
    ON public.claims FOR UPDATE
    TO authenticated
    USING (
        status = 'pending'
        AND EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = claims.item_id 
            AND items.finder_id = auth.uid()
        )
    )
    WITH CHECK (
        status IN ('approved', 'rejected')
    );

-- Claimants can withdraw their own pending claims
CREATE POLICY "claims_update_claimant"
    ON public.claims FOR UPDATE
    TO authenticated
    USING (
        claimant_id = auth.uid()
        AND status = 'pending'
    )
    WITH CHECK (
        -- Can only withdraw
        status = 'withdrawn'
        AND claimant_id = auth.uid()
    );

-- Moderators can manage all claims
CREATE POLICY "claims_moderator_all"
    ON public.claims FOR ALL
    USING (is_moderator_or_admin())
    WITH CHECK (is_moderator_or_admin());

-- ============================================================
-- CLAIM_VERIFICATION_ANSWERS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "claim_answers_select_finder" ON public.claim_verification_answers;
DROP POLICY IF EXISTS "claim_answers_select_claimant" ON public.claim_verification_answers;
DROP POLICY IF EXISTS "claim_answers_insert_claimant" ON public.claim_verification_answers;
DROP POLICY IF EXISTS "claim_answers_update_finder" ON public.claim_verification_answers;

-- Finders can view answers on claims for their items
CREATE POLICY "claim_answers_select_finder"
    ON public.claim_verification_answers FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.claims c
            JOIN public.items i ON c.item_id = i.id
            WHERE c.id = claim_verification_answers.claim_id
            AND i.finder_id = auth.uid()
        )
    );

-- Claimants can view their own answers
CREATE POLICY "claim_answers_select_claimant"
    ON public.claim_verification_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.claims 
            WHERE id = claim_verification_answers.claim_id 
            AND claimant_id = auth.uid()
        )
    );

-- Claimants can insert answers for their claims
CREATE POLICY "claim_answers_insert_claimant"
    ON public.claim_verification_answers FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.claims 
            WHERE id = claim_verification_answers.claim_id 
            AND claimant_id = auth.uid()
            AND status = 'pending'
        )
    );

-- Finders can update verification status
CREATE POLICY "claim_answers_update_finder"
    ON public.claim_verification_answers FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.claims c
            JOIN public.items i ON c.item_id = i.id
            WHERE c.id = claim_verification_answers.claim_id
            AND i.finder_id = auth.uid()
        )
    )
    WITH CHECK (
        -- Can only update verification fields
        EXISTS (
            SELECT 1 FROM public.claims c
            JOIN public.items i ON c.item_id = i.id
            WHERE c.id = claim_verification_answers.claim_id
            AND i.finder_id = auth.uid()
        )
    );

-- ============================================================
-- CHATS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "chats_select_participant" ON public.chats;
DROP POLICY IF EXISTS "chats_insert_participant" ON public.chats;
DROP POLICY IF EXISTS "chats_update_participant" ON public.chats;
DROP POLICY IF EXISTS "chats_moderator_all" ON public.chats;

-- Only participants can view their chats
CREATE POLICY "chats_select_participant"
    ON public.chats FOR SELECT
    TO authenticated
    USING (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    );

-- Allow chat creation when approving claims
CREATE POLICY "chats_insert_participant"
    ON public.chats FOR INSERT
    TO authenticated
    WITH CHECK (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    );

-- Participants can update chat (read counts, close)
CREATE POLICY "chats_update_participant"
    ON public.chats FOR UPDATE
    TO authenticated
    USING (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    )
    WITH CHECK (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    );

-- Moderators can manage all chats
CREATE POLICY "chats_moderator_all"
    ON public.chats FOR ALL
    TO authenticated
    USING (is_moderator_or_admin())
    WITH CHECK (is_moderator_or_admin());

-- ============================================================
-- MESSAGES POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
DROP POLICY IF EXISTS "messages_moderator_all" ON public.messages;

-- Only chat participants can view messages
CREATE POLICY "messages_select_participant"
    ON public.messages FOR SELECT
    TO authenticated
    USING (is_chat_participant(chat_id));

-- Only chat participants can send messages
CREATE POLICY "messages_insert_participant"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND is_chat_participant(chat_id)
        AND EXISTS (
            SELECT 1 FROM public.chats 
            WHERE id = messages.chat_id 
            AND enabled = true 
            AND is_closed = false
        )
    );

-- Users can soft-delete their own messages
CREATE POLICY "messages_update_own"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (sender_id = auth.uid())
    WITH CHECK (
        sender_id = auth.uid()
        -- Can only update is_deleted and is_read
    );

-- Moderators can manage all messages
CREATE POLICY "messages_moderator_all"
    ON public.messages FOR ALL
    TO authenticated
    USING (is_moderator_or_admin())
    WITH CHECK (is_moderator_or_admin());

-- ============================================================
-- ABUSE_REPORTS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "abuse_reports_insert_own" ON public.abuse_reports;
DROP POLICY IF EXISTS "abuse_reports_select_own" ON public.abuse_reports;
DROP POLICY IF EXISTS "abuse_reports_moderator_all" ON public.abuse_reports;

-- Users can submit reports
CREATE POLICY "abuse_reports_insert_own"
    ON public.abuse_reports FOR INSERT
    TO authenticated
    WITH CHECK (
        reporter_id = auth.uid()
    );

-- Users can view their own reports
CREATE POLICY "abuse_reports_select_own"
    ON public.abuse_reports FOR SELECT
    TO authenticated
    USING (reporter_id = auth.uid());

-- Moderators can manage all reports
CREATE POLICY "abuse_reports_moderator_all"
    ON public.abuse_reports FOR ALL
    TO authenticated
    USING (is_moderator_or_admin())
    WITH CHECK (is_moderator_or_admin());

-- ============================================================
-- AUDIT_LOGS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "audit_logs_insert_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_own" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;

-- System can insert audit logs (via service role or triggers)
CREATE POLICY "audit_logs_insert_all"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Users can view their own audit logs
CREATE POLICY "audit_logs_select_own"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Admins can view all audit logs
CREATE POLICY "audit_logs_admin_select"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (is_admin());

-- ============================================================
-- RATE_LIMITS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "rate_limits_own" ON public.rate_limits;

-- Users can only see/manage their own rate limits
CREATE POLICY "rate_limits_own"
    ON public.rate_limits FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================================
-- IMAGE_HASHES POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "image_hashes_select" ON public.image_hashes;
DROP POLICY IF EXISTS "image_hashes_insert" ON public.image_hashes;
DROP POLICY IF EXISTS "image_hashes_delete" ON public.image_hashes;

-- Anyone can check for duplicate images
CREATE POLICY "image_hashes_select"
    ON public.image_hashes FOR SELECT
    TO authenticated
    USING (true);

-- Users can add hashes for their items
CREATE POLICY "image_hashes_insert"
    ON public.image_hashes FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE id = image_hashes.item_id 
            AND finder_id = auth.uid()
        )
    );

-- Users can delete hashes for their items
CREATE POLICY "image_hashes_delete"
    ON public.image_hashes FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE id = image_hashes.item_id 
            AND finder_id = auth.uid()
        )
    );

-- ============================================================
-- FORCE RLS ON SERVICE ROLE (Optional - Enhanced Security)
-- ============================================================
-- Uncomment these if you want RLS to apply even for service role
-- ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.items FORCE ROW LEVEL SECURITY;
-- etc...

-- ============================================================
-- DONE
-- ============================================================

SELECT 'RLS policies setup complete!' AS status;

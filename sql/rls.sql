-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- Lost & Found Bangalore
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is banned
CREATE OR REPLACE FUNCTION public.is_banned()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_banned = TRUE 
        AND (banned_until IS NULL OR banned_until > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_action_type TEXT,
    p_limit INTEGER,
    p_window_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.rate_limits
    WHERE user_id = auth.uid()
    AND action_type = p_action_type
    AND window_start > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    
    RETURN v_count < p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- USERS POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

-- Users can view other users' public info (limited fields via views)
CREATE POLICY "Users can view others public info"
    ON public.users FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND role = (SELECT role FROM public.users WHERE id = auth.uid()) -- Can't change own role
    );

-- Admins can do everything
CREATE POLICY "Admins full access to users"
    ON public.users FOR ALL
    USING (public.is_admin());

-- ============================================
-- CATEGORIES POLICIES
-- ============================================

-- Anyone authenticated can view categories
CREATE POLICY "Authenticated users can view categories"
    ON public.categories FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can modify categories
CREATE POLICY "Admins can manage categories"
    ON public.categories FOR ALL
    USING (public.is_admin());

-- ============================================
-- AREAS POLICIES
-- ============================================

-- Anyone authenticated can view areas
CREATE POLICY "Authenticated users can view areas"
    ON public.areas FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can modify areas
CREATE POLICY "Admins can manage areas"
    ON public.areas FOR ALL
    USING (public.is_admin());

-- ============================================
-- ITEMS POLICIES
-- ============================================

-- Anyone can view non-deleted, non-flagged items
CREATE POLICY "Public can view active items"
    ON public.items FOR SELECT
    USING (
        is_deleted = FALSE 
        AND is_flagged = FALSE 
        AND status != 'deleted'
    );

-- Finder can view their own items regardless of status
CREATE POLICY "Finders can view own items"
    ON public.items FOR SELECT
    USING (finder_id = auth.uid());

-- Authenticated non-banned users can create items
CREATE POLICY "Users can create items"
    ON public.items FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND finder_id = auth.uid()
        AND NOT public.is_banned()
    );

-- Finder can update their own items
CREATE POLICY "Finders can update own items"
    ON public.items FOR UPDATE
    USING (finder_id = auth.uid())
    WITH CHECK (finder_id = auth.uid());

-- Finder can soft delete their own items
CREATE POLICY "Finders can delete own items"
    ON public.items FOR UPDATE
    USING (finder_id = auth.uid())
    WITH CHECK (
        finder_id = auth.uid() 
        AND is_deleted = TRUE
    );

-- Admins full access
CREATE POLICY "Admins full access to items"
    ON public.items FOR ALL
    USING (public.is_admin());

-- ============================================
-- ITEM IMAGES POLICIES
-- ============================================

-- Anyone can view images of visible items
CREATE POLICY "Public can view item images"
    ON public.item_images FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = item_images.item_id 
            AND is_deleted = FALSE 
            AND is_flagged = FALSE
        )
    );

-- Finder can manage images of their items
CREATE POLICY "Finders can manage own item images"
    ON public.item_images FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = item_images.item_id 
            AND items.finder_id = auth.uid()
        )
    );

-- Admins full access
CREATE POLICY "Admins full access to item images"
    ON public.item_images FOR ALL
    USING (public.is_admin());

-- ============================================
-- CLAIMS POLICIES
-- ============================================

-- Claimants can view their own claims
CREATE POLICY "Claimants can view own claims"
    ON public.claims FOR SELECT
    USING (claimant_id = auth.uid());

-- Finders can view claims on their items
CREATE POLICY "Finders can view claims on own items"
    ON public.claims FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = claims.item_id 
            AND items.finder_id = auth.uid()
        )
    );

-- Users can create claims (max 3 per item)
CREATE POLICY "Users can create claims"
    ON public.claims FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND claimant_id = auth.uid()
        AND NOT public.is_banned()
        AND attempt_number <= 3
        AND NOT EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = claims.item_id 
            AND items.finder_id = auth.uid() -- Can't claim own item
        )
    );

-- Claimants can update their own pending claims (withdraw)
CREATE POLICY "Claimants can withdraw own claims"
    ON public.claims FOR UPDATE
    USING (claimant_id = auth.uid() AND status = 'pending')
    WITH CHECK (claimant_id = auth.uid() AND status = 'withdrawn');

-- Finders can update claim status on their items
CREATE POLICY "Finders can review claims"
    ON public.claims FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = claims.item_id 
            AND items.finder_id = auth.uid()
        )
    );

-- Admins full access
CREATE POLICY "Admins full access to claims"
    ON public.claims FOR ALL
    USING (public.is_admin());

-- ============================================
-- CLAIM ANSWERS POLICIES
-- ============================================

-- Claimants can view and manage their own answers
CREATE POLICY "Claimants can manage own answers"
    ON public.claim_answers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.claims 
            WHERE claims.id = claim_answers.claim_id 
            AND claims.claimant_id = auth.uid()
        )
    );

-- Finders can view answers for claims on their items
CREATE POLICY "Finders can view claim answers"
    ON public.claim_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.claims 
            JOIN public.items ON items.id = claims.item_id
            WHERE claims.id = claim_answers.claim_id 
            AND items.finder_id = auth.uid()
        )
    );

-- Admins full access
CREATE POLICY "Admins full access to claim answers"
    ON public.claim_answers FOR ALL
    USING (public.is_admin());

-- ============================================
-- CHATS POLICIES
-- ============================================

-- Participants can view their chats
CREATE POLICY "Participants can view chats"
    ON public.chats FOR SELECT
    USING (finder_id = auth.uid() OR claimant_id = auth.uid());

-- System creates chats (via trigger/function)
CREATE POLICY "System can create chats"
    ON public.chats FOR INSERT
    WITH CHECK (
        (finder_id = auth.uid() OR claimant_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.claims 
            WHERE claims.id = chats.claim_id 
            AND claims.status = 'approved'
        )
    );

-- Participants can update read status
CREATE POLICY "Participants can update chat"
    ON public.chats FOR UPDATE
    USING (finder_id = auth.uid() OR claimant_id = auth.uid());

-- Admins full access
CREATE POLICY "Admins full access to chats"
    ON public.chats FOR ALL
    USING (public.is_admin());

-- ============================================
-- CHAT MESSAGES POLICIES
-- ============================================

-- Participants can view messages in their chats
CREATE POLICY "Participants can view messages"
    ON public.chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = chat_messages.chat_id 
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
        )
    );

-- Participants can send messages
CREATE POLICY "Participants can send messages"
    ON public.chat_messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND NOT public.is_banned()
        AND EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = chat_messages.chat_id 
            AND chats.is_active = TRUE
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
        )
    );

-- Sender can soft delete own messages
CREATE POLICY "Senders can delete own messages"
    ON public.chat_messages FOR UPDATE
    USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid() AND is_deleted = TRUE);

-- Admins full access
CREATE POLICY "Admins full access to messages"
    ON public.chat_messages FOR ALL
    USING (public.is_admin());

-- ============================================
-- ABUSE REPORTS POLICIES
-- ============================================

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
    ON public.abuse_reports FOR SELECT
    USING (reporter_id = auth.uid());

-- Users can create reports
CREATE POLICY "Users can create reports"
    ON public.abuse_reports FOR INSERT
    WITH CHECK (
        reporter_id = auth.uid()
        AND NOT public.is_banned()
    );

-- Admins full access
CREATE POLICY "Admins full access to reports"
    ON public.abuse_reports FOR ALL
    USING (public.is_admin());

-- ============================================
-- AUDIT LOGS POLICIES
-- ============================================

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
    ON public.audit_logs FOR SELECT
    USING (user_id = auth.uid());

-- System inserts audit logs
CREATE POLICY "System can create audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Admins full access
CREATE POLICY "Admins full access to audit logs"
    ON public.audit_logs FOR ALL
    USING (public.is_admin());

-- ============================================
-- RATE LIMITS POLICIES
-- ============================================

-- System manages rate limits
CREATE POLICY "System can manage rate limits"
    ON public.rate_limits FOR ALL
    USING (auth.uid() IS NOT NULL);

-- ============================================
-- USER SESSIONS POLICIES
-- ============================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
    ON public.user_sessions FOR SELECT
    USING (user_id = auth.uid());

-- Users can manage their own sessions
CREATE POLICY "Users can manage own sessions"
    ON public.user_sessions FOR ALL
    USING (user_id = auth.uid());

-- Admins full access
CREATE POLICY "Admins full access to sessions"
    ON public.user_sessions FOR ALL
    USING (public.is_admin());

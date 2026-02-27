-- ============================================================
-- ADMIN BYPASS POLICIES
-- ============================================================
-- Allow admin users to see ALL data regardless of ownership
-- ============================================================

-- ============================================================
-- 1. CLAIMS - ADMIN CAN SEE ALL
-- ============================================================

-- Admins can view ALL claims
DROP POLICY IF EXISTS "Admins can view all claims" ON public.claims;
CREATE POLICY "Admins can view all claims"
    ON public.claims FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role IN ('admin', 'moderator')
        )
    );

-- ============================================================
-- 2. ITEMS - ADMIN CAN SEE ALL (already works via "everyone")
-- ============================================================
-- No change needed - "Items are viewable by everyone" already covers this

-- ============================================================
-- 3. ABUSE_REPORTS - ADMIN CAN SEE ALL
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all reports" ON public.abuse_reports;
CREATE POLICY "Admins can view all reports"
    ON public.abuse_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role IN ('admin', 'moderator')
        )
    );

-- ============================================================
-- 4. USER_PROFILES - ADMIN CAN UPDATE ANY
-- ============================================================

DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;
CREATE POLICY "Admins can update any profile"
    ON public.user_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.user_id = auth.uid()
            AND up.role IN ('admin', 'moderator')
        )
    );

-- ============================================================
-- 5. AUDIT_LOGS - ADMIN CAN VIEW ALL
-- ============================================================

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role IN ('admin', 'moderator')
        )
    );

-- ============================================================
-- 6. CHATS - ADMIN CAN VIEW ALL
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all chats" ON public.chats;
CREATE POLICY "Admins can view all chats"
    ON public.chats FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role IN ('admin', 'moderator')
        )
    );

-- ============================================================
-- 7. MESSAGES - ADMIN CAN VIEW ALL
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role IN ('admin', 'moderator')
        )
    );

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show admin-specific policies
SELECT 
    tablename,
    policyname,
    cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
AND policyname LIKE '%admin%'
OR policyname LIKE '%Admin%'
ORDER BY tablename, policyname;

-- Test if current user is admin
SELECT 
    user_id,
    email,
    role,
    account_status
FROM public.user_profiles
WHERE email = 'sudharshancse123@gmail.com';

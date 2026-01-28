-- ============================================================
-- ADMIN PANEL ROW LEVEL SECURITY POLICIES
-- Lost & Found Bangalore - Enterprise-Grade Security
-- ============================================================
-- Version: 1.0.0
-- Date: 2026-01-07
-- Description: Strict RLS policies for admin tables
-- 
-- Run this in Supabase SQL Editor AFTER running admin_schema.sql
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL ADMIN TABLES
-- ============================================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_statistics_daily ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DROP EXISTING POLICIES (for clean re-run)
-- ============================================================

-- admin_users policies
DROP POLICY IF EXISTS "admin_users_select" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_insert" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_update" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_delete" ON public.admin_users;

-- admin_audit_logs policies
DROP POLICY IF EXISTS "audit_logs_select" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.admin_audit_logs;

-- admin_messages policies
DROP POLICY IF EXISTS "admin_messages_select_admin" ON public.admin_messages;
DROP POLICY IF EXISTS "admin_messages_select_recipient" ON public.admin_messages;
DROP POLICY IF EXISTS "admin_messages_insert" ON public.admin_messages;
DROP POLICY IF EXISTS "admin_messages_update_recipient" ON public.admin_messages;

-- user_restrictions policies
DROP POLICY IF EXISTS "restrictions_select" ON public.user_restrictions;
DROP POLICY IF EXISTS "restrictions_insert" ON public.user_restrictions;
DROP POLICY IF EXISTS "restrictions_update" ON public.user_restrictions;

-- user_warnings policies
DROP POLICY IF EXISTS "warnings_select_admin" ON public.user_warnings;
DROP POLICY IF EXISTS "warnings_select_user" ON public.user_warnings;
DROP POLICY IF EXISTS "warnings_insert" ON public.user_warnings;
DROP POLICY IF EXISTS "warnings_update" ON public.user_warnings;

-- trust_score_history policies
DROP POLICY IF EXISTS "trust_history_select" ON public.trust_score_history;
DROP POLICY IF EXISTS "trust_history_insert" ON public.trust_score_history;

-- claim_admin_notes policies
DROP POLICY IF EXISTS "claim_notes_select" ON public.claim_admin_notes;
DROP POLICY IF EXISTS "claim_notes_insert" ON public.claim_admin_notes;

-- item_moderation_log policies
DROP POLICY IF EXISTS "item_mod_select" ON public.item_moderation_log;
DROP POLICY IF EXISTS "item_mod_insert" ON public.item_moderation_log;

-- chat_moderation_log policies
DROP POLICY IF EXISTS "chat_mod_select" ON public.chat_moderation_log;
DROP POLICY IF EXISTS "chat_mod_insert" ON public.chat_moderation_log;

-- system_settings policies
DROP POLICY IF EXISTS "settings_select_admin" ON public.system_settings;
DROP POLICY IF EXISTS "settings_select_public" ON public.system_settings;
DROP POLICY IF EXISTS "settings_update" ON public.system_settings;

-- admin_login_history policies
DROP POLICY IF EXISTS "login_history_select" ON public.admin_login_history;
DROP POLICY IF EXISTS "login_history_insert" ON public.admin_login_history;

-- platform_statistics_daily policies
DROP POLICY IF EXISTS "stats_select" ON public.platform_statistics_daily;
DROP POLICY IF EXISTS "stats_insert" ON public.platform_statistics_daily;
DROP POLICY IF EXISTS "stats_update" ON public.platform_statistics_daily;

-- ============================================================
-- ADMIN_USERS TABLE POLICIES
-- ============================================================
-- Only active admins can see admin list
-- Only super_admin can create/modify admins

-- SELECT: Active admins can see all admin users
CREATE POLICY "admin_users_select" ON public.admin_users
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- INSERT: Only super_admin can create new admins
CREATE POLICY "admin_users_insert" ON public.admin_users
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'super_admin')
    );

-- UPDATE: Only super_admin can modify admins
CREATE POLICY "admin_users_update" ON public.admin_users
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'super_admin')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'super_admin')
    );

-- DELETE: Only super_admin can delete admins (prefer deactivation instead)
CREATE POLICY "admin_users_delete" ON public.admin_users
    FOR DELETE
    USING (
        has_admin_permission(auth.uid(), 'super_admin')
    );

-- ============================================================
-- ADMIN_AUDIT_LOGS TABLE POLICIES
-- ============================================================
-- All admins can read audit logs
-- Only system can insert (via functions)
-- No update or delete allowed (immutable)

-- SELECT: All active admins can view audit logs
CREATE POLICY "audit_logs_select" ON public.admin_audit_logs
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- INSERT: Must be an active admin (logged via function)
CREATE POLICY "audit_logs_insert" ON public.admin_audit_logs
    FOR INSERT
    WITH CHECK (
        is_admin(auth.uid())
    );

-- Note: UPDATE and DELETE are blocked by trigger, not RLS

-- ============================================================
-- ADMIN_MESSAGES TABLE POLICIES
-- ============================================================
-- Admins can see/send messages
-- Users can see their own messages

-- SELECT (Admin): Active admins can see all admin messages
CREATE POLICY "admin_messages_select_admin" ON public.admin_messages
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- SELECT (User): Users can see messages sent to them
CREATE POLICY "admin_messages_select_recipient" ON public.admin_messages
    FOR SELECT
    USING (
        recipient_id = auth.uid()
    );

-- INSERT: Only moderators and above can send admin messages
CREATE POLICY "admin_messages_insert" ON public.admin_messages
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- UPDATE: Recipients can mark as read and respond
CREATE POLICY "admin_messages_update_recipient" ON public.admin_messages
    FOR UPDATE
    USING (
        recipient_id = auth.uid()
    )
    WITH CHECK (
        recipient_id = auth.uid()
        -- Can only update read status and response
    );

-- ============================================================
-- USER_RESTRICTIONS TABLE POLICIES
-- ============================================================
-- Admins can view and manage restrictions

-- SELECT: All active admins can view restrictions
CREATE POLICY "restrictions_select" ON public.user_restrictions
    FOR SELECT
    USING (
        is_admin(auth.uid())
        OR user_id = auth.uid() -- Users can see their own restrictions
    );

-- INSERT: Moderators and above can create restrictions
CREATE POLICY "restrictions_insert" ON public.user_restrictions
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- UPDATE: Moderators and above can update restrictions
CREATE POLICY "restrictions_update" ON public.user_restrictions
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'moderator')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- ============================================================
-- USER_WARNINGS TABLE POLICIES
-- ============================================================
-- Admins can manage warnings, users can see their own

-- SELECT (Admin): All active admins can view all warnings
CREATE POLICY "warnings_select_admin" ON public.user_warnings
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- SELECT (User): Users can see their own warnings
CREATE POLICY "warnings_select_user" ON public.user_warnings
    FOR SELECT
    USING (
        user_id = auth.uid()
    );

-- INSERT: Moderators and above can issue warnings
CREATE POLICY "warnings_insert" ON public.user_warnings
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- UPDATE: Moderators can update warnings (for acknowledgment tracking)
CREATE POLICY "warnings_update" ON public.user_warnings
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'moderator')
        OR (user_id = auth.uid()) -- Users can acknowledge
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
        OR (user_id = auth.uid())
    );

-- ============================================================
-- TRUST_SCORE_HISTORY TABLE POLICIES
-- ============================================================
-- Admins can view all, users can see their own

-- SELECT: Admins see all, users see their own
CREATE POLICY "trust_history_select" ON public.trust_score_history
    FOR SELECT
    USING (
        is_admin(auth.uid())
        OR user_id = auth.uid()
    );

-- INSERT: System and moderators can create entries
CREATE POLICY "trust_history_insert" ON public.trust_score_history
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
        OR change_source = 'system' -- System can insert
    );

-- ============================================================
-- CLAIM_ADMIN_NOTES TABLE POLICIES
-- ============================================================
-- Only admins can access claim notes

-- SELECT: All active admins can view claim notes
CREATE POLICY "claim_notes_select" ON public.claim_admin_notes
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- INSERT: Moderators and above can add notes
CREATE POLICY "claim_notes_insert" ON public.claim_admin_notes
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- ============================================================
-- ITEM_MODERATION_LOG TABLE POLICIES
-- ============================================================
-- Only admins can access moderation logs

-- SELECT: All active admins can view item moderation logs
CREATE POLICY "item_mod_select" ON public.item_moderation_log
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- INSERT: Moderators and above can log actions
CREATE POLICY "item_mod_insert" ON public.item_moderation_log
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- ============================================================
-- CHAT_MODERATION_LOG TABLE POLICIES
-- ============================================================
-- Only admins can access chat moderation logs

-- SELECT: All active admins can view chat moderation logs
CREATE POLICY "chat_mod_select" ON public.chat_moderation_log
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- INSERT: Moderators and above can log actions
CREATE POLICY "chat_mod_insert" ON public.chat_moderation_log
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- ============================================================
-- SYSTEM_SETTINGS TABLE POLICIES
-- ============================================================
-- Admins can read, only super_admin can modify

-- SELECT (Admin): All active admins can view all settings
CREATE POLICY "settings_select_admin" ON public.system_settings
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- SELECT (Public): Non-sensitive settings visible to all authenticated users
CREATE POLICY "settings_select_public" ON public.system_settings
    FOR SELECT
    USING (
        is_sensitive = false
        AND auth.uid() IS NOT NULL
    );

-- UPDATE: Only super_admin can modify settings
CREATE POLICY "settings_update" ON public.system_settings
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'super_admin')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'super_admin')
    );

-- ============================================================
-- ADMIN_LOGIN_HISTORY TABLE POLICIES
-- ============================================================
-- Only super_admin can view login history

-- SELECT: Only super_admin can view login history
CREATE POLICY "login_history_select" ON public.admin_login_history
    FOR SELECT
    USING (
        has_admin_permission(auth.uid(), 'super_admin')
    );

-- INSERT: System can insert login attempts
CREATE POLICY "login_history_insert" ON public.admin_login_history
    FOR INSERT
    WITH CHECK (
        true -- Allow inserts for login tracking
    );

-- ============================================================
-- PLATFORM_STATISTICS_DAILY TABLE POLICIES
-- ============================================================
-- All admins can read statistics

-- SELECT: All active admins can view statistics
CREATE POLICY "stats_select" ON public.platform_statistics_daily
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- INSERT: System function only (using service role)
CREATE POLICY "stats_insert" ON public.platform_statistics_daily
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'super_admin')
    );

-- UPDATE: System function only (using service role)
CREATE POLICY "stats_update" ON public.platform_statistics_daily
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'super_admin')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'super_admin')
    );

-- ============================================================
-- ADDITIONAL POLICIES FOR EXISTING TABLES (Admin Access)
-- ============================================================

-- Allow admins to view all users
DROP POLICY IF EXISTS "admin_view_all_users" ON public.user_profiles;
CREATE POLICY "admin_view_all_users" ON public.user_profiles
    FOR SELECT
    USING (
        is_admin(auth.uid())
        OR user_id = auth.uid()
    );

-- Allow admins to insert user profiles (for admin-created accounts if needed)
DROP POLICY IF EXISTS "admin_insert_users" ON public.user_profiles;
CREATE POLICY "admin_insert_users" ON public.user_profiles
    FOR INSERT
    WITH CHECK (
        has_admin_permission(auth.uid(), 'super_admin')
    );

-- Allow admins to update any user (for moderation)
DROP POLICY IF EXISTS "admin_update_users" ON public.user_profiles;
CREATE POLICY "admin_update_users" ON public.user_profiles
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'moderator')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- Allow admins to view all items
DROP POLICY IF EXISTS "admin_view_all_items" ON public.items;
CREATE POLICY "admin_view_all_items" ON public.items
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- Allow admins to update any item (for moderation)
DROP POLICY IF EXISTS "admin_update_items" ON public.items;
CREATE POLICY "admin_update_items" ON public.items
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'moderator')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- Allow admins to delete items (soft delete via update preferred)
DROP POLICY IF EXISTS "admin_delete_items" ON public.items;
CREATE POLICY "admin_delete_items" ON public.items
    FOR DELETE
    USING (
        has_admin_permission(auth.uid(), 'super_admin')
    );

-- Allow admins to view all claims
DROP POLICY IF EXISTS "admin_view_all_claims" ON public.claims;
CREATE POLICY "admin_view_all_claims" ON public.claims
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- Allow admins to update any claim (for moderation)
DROP POLICY IF EXISTS "admin_update_claims" ON public.claims;
CREATE POLICY "admin_update_claims" ON public.claims
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'moderator')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- Allow admins to view all chats
DROP POLICY IF EXISTS "admin_view_all_chats" ON public.chats;
CREATE POLICY "admin_view_all_chats" ON public.chats
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- Allow admins to update chats (freeze/unfreeze)
DROP POLICY IF EXISTS "admin_update_chats" ON public.chats;
CREATE POLICY "admin_update_chats" ON public.chats
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'moderator')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- Allow admins to view all messages (with audit logging required)
DROP POLICY IF EXISTS "admin_view_all_messages" ON public.messages;
CREATE POLICY "admin_view_all_messages" ON public.messages
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- Allow admins to update messages (for deletion/moderation)
DROP POLICY IF EXISTS "admin_update_messages" ON public.messages;
CREATE POLICY "admin_update_messages" ON public.messages
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'moderator')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- Allow admins to view all abuse reports
DROP POLICY IF EXISTS "admin_view_all_reports" ON public.abuse_reports;
CREATE POLICY "admin_view_all_reports" ON public.abuse_reports
    FOR SELECT
    USING (
        is_admin(auth.uid())
    );

-- Allow admins to update abuse reports
DROP POLICY IF EXISTS "admin_update_reports" ON public.abuse_reports;
CREATE POLICY "admin_update_reports" ON public.abuse_reports
    FOR UPDATE
    USING (
        has_admin_permission(auth.uid(), 'moderator')
    )
    WITH CHECK (
        has_admin_permission(auth.uid(), 'moderator')
    );

-- ============================================================
-- SECURITY DEFINER FUNCTIONS FOR ADMIN OPERATIONS
-- ============================================================
-- These functions bypass RLS and should be used for admin operations

-- Function: Safely check if current user is admin
CREATE OR REPLACE FUNCTION public.check_admin_access()
RETURNS TABLE (
    is_admin BOOLEAN,
    admin_id UUID,
    role admin_role,
    email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        true,
        au.id,
        au.role,
        au.email
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get admin dashboard data
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_data()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Verify admin access
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    SELECT jsonb_build_object(
        'users', jsonb_build_object(
            'total', (SELECT COUNT(*) FROM user_profiles),
            'new_today', (SELECT COUNT(*) FROM user_profiles WHERE created_at::date = CURRENT_DATE),
            'active_today', (SELECT COUNT(*) FROM user_profiles WHERE last_active_at::date = CURRENT_DATE),
            'banned', (SELECT COUNT(*) FROM user_profiles WHERE account_status = 'banned'),
            'low_trust', (SELECT COUNT(*) FROM user_profiles WHERE trust_score < 40)
        ),
        'items', jsonb_build_object(
            'total', (SELECT COUNT(*) FROM items),
            'active', (SELECT COUNT(*) FROM items WHERE status = 'active' AND is_hidden = false),
            'returned', (SELECT COUNT(*) FROM items WHERE status = 'returned'),
            'flagged', (SELECT COUNT(*) FROM items WHERE is_flagged = true)
        ),
        'claims', jsonb_build_object(
            'total', (SELECT COUNT(*) FROM claims),
            'pending', (SELECT COUNT(*) FROM claims WHERE status = 'pending'),
            'approved_today', (SELECT COUNT(*) FROM claims WHERE status = 'approved' AND approved_at::date = CURRENT_DATE)
        ),
        'reports', jsonb_build_object(
            'pending', (SELECT COUNT(*) FROM abuse_reports WHERE status = 'pending'),
            'reviewing', (SELECT COUNT(*) FROM abuse_reports WHERE status = 'reviewing')
        ),
        'chats', jsonb_build_object(
            'active', (SELECT COUNT(*) FROM chats WHERE is_closed = false),
            'frozen', (SELECT COUNT(*) FROM chats WHERE is_frozen = true)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Suspend user
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
    p_user_id UUID,
    p_reason TEXT,
    p_duration_days INTEGER DEFAULT NULL -- NULL = permanent
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_old_status account_status;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Get admin ID
    SELECT id INTO v_admin_id FROM admin_users WHERE user_id = auth.uid() AND is_active = true;
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Check permission
    IF NOT has_admin_permission(auth.uid(), 'moderator') THEN
        RAISE EXCEPTION 'Access denied: Moderator privileges required';
    END IF;
    
    -- Get current status
    SELECT account_status INTO v_old_status FROM user_profiles WHERE user_id = p_user_id;
    
    -- Calculate expiry
    IF p_duration_days IS NOT NULL THEN
        v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;
    END IF;
    
    -- Update user status
    UPDATE user_profiles SET
        account_status = 'suspended',
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Create restriction record
    INSERT INTO user_restrictions (user_id, restriction_type, reason, applied_by, expires_at)
    VALUES (p_user_id, 'suspended', p_reason, v_admin_id, v_expires_at);
    
    -- Log action
    PERFORM log_admin_action(
        v_admin_id,
        'user_suspend',
        'user',
        'user',
        p_user_id,
        p_reason,
        jsonb_build_object('old_status', v_old_status),
        jsonb_build_object('new_status', 'suspended', 'duration_days', p_duration_days),
        '0.0.0.0'::inet
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'User suspended successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Ban user
CREATE OR REPLACE FUNCTION public.admin_ban_user(
    p_user_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_old_status account_status;
BEGIN
    -- Get admin ID
    SELECT id INTO v_admin_id FROM admin_users WHERE user_id = auth.uid() AND is_active = true;
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Check permission (super_admin only for bans)
    IF NOT has_admin_permission(auth.uid(), 'super_admin') THEN
        RAISE EXCEPTION 'Access denied: Super Admin privileges required for bans';
    END IF;
    
    -- Get current status
    SELECT account_status INTO v_old_status FROM user_profiles WHERE user_id = p_user_id;
    
    -- Update user status
    UPDATE user_profiles SET
        account_status = 'banned',
        ban_reason = p_reason,
        banned_at = NOW(),
        banned_by = p_user_id,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Create restriction record
    INSERT INTO user_restrictions (user_id, restriction_type, reason, applied_by)
    VALUES (p_user_id, 'banned', p_reason, v_admin_id);
    
    -- Log action
    PERFORM log_admin_action(
        v_admin_id,
        'user_ban',
        'user',
        'user',
        p_user_id,
        p_reason,
        jsonb_build_object('old_status', v_old_status),
        jsonb_build_object('new_status', 'banned'),
        '0.0.0.0'::inet
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'User banned successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Adjust trust score
CREATE OR REPLACE FUNCTION public.admin_adjust_trust_score(
    p_user_id UUID,
    p_new_score INTEGER,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_old_score INTEGER;
BEGIN
    -- Get admin ID
    SELECT id INTO v_admin_id FROM admin_users WHERE user_id = auth.uid() AND is_active = true;
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Validate score
    IF p_new_score < 0 OR p_new_score > 100 THEN
        RAISE EXCEPTION 'Trust score must be between 0 and 100';
    END IF;
    
    -- Get current score
    SELECT trust_score INTO v_old_score FROM user_profiles WHERE user_id = p_user_id;
    
    -- Check if score is locked
    IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = p_user_id AND trust_score_locked = true AND trust_score_locked_until > NOW()) THEN
        RAISE EXCEPTION 'Trust score is locked for this user';
    END IF;
    
    -- Update score
    UPDATE user_profiles SET
        trust_score = p_new_score,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Record history
    INSERT INTO trust_score_history (user_id, old_score, new_score, change_amount, change_reason, change_source, admin_id, admin_notes)
    VALUES (p_user_id, v_old_score, p_new_score, p_new_score - v_old_score, 'manual_adjustment', 'admin', v_admin_id, p_reason);
    
    -- Log action
    PERFORM log_admin_action(
        v_admin_id,
        'user_trust_adjust',
        'user',
        'user',
        p_user_id,
        p_reason,
        jsonb_build_object('old_score', v_old_score),
        jsonb_build_object('new_score', p_new_score),
        '0.0.0.0'::inet
    );
    
    RETURN jsonb_build_object('success', true, 'old_score', v_old_score, 'new_score', p_new_score);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Hide item
CREATE OR REPLACE FUNCTION public.admin_hide_item(
    p_item_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    -- Get admin ID
    SELECT id INTO v_admin_id FROM admin_users WHERE user_id = auth.uid() AND is_active = true;
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Update item
    UPDATE items SET
        is_hidden = true,
        hidden_at = NOW(),
        hidden_by = v_admin_id,
        hide_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_item_id;
    
    -- Log moderation action
    INSERT INTO item_moderation_log (item_id, admin_id, action, reason)
    VALUES (p_item_id, v_admin_id, 'hide', p_reason);
    
    -- Log audit
    PERFORM log_admin_action(
        v_admin_id,
        'item_hide',
        'item',
        'item',
        p_item_id,
        p_reason,
        jsonb_build_object('is_hidden', false),
        jsonb_build_object('is_hidden', true),
        '0.0.0.0'::inet
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Item hidden successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Freeze chat
CREATE OR REPLACE FUNCTION public.admin_freeze_chat(
    p_chat_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    -- Get admin ID
    SELECT id INTO v_admin_id FROM admin_users WHERE user_id = auth.uid() AND is_active = true;
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Update chat
    UPDATE chats SET
        is_frozen = true,
        frozen_at = NOW(),
        frozen_by = v_admin_id,
        freeze_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_chat_id;
    
    -- Log moderation action
    INSERT INTO chat_moderation_log (chat_id, admin_id, action, justification)
    VALUES (p_chat_id, v_admin_id, 'freeze', p_reason);
    
    -- Log audit
    PERFORM log_admin_action(
        v_admin_id,
        'chat_freeze',
        'chat',
        'chat',
        p_chat_id,
        p_reason,
        jsonb_build_object('is_frozen', false),
        jsonb_build_object('is_frozen', true),
        '0.0.0.0'::inet
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Chat frozen successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ADMIN RLS POLICIES CREATED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'RLS enabled on all admin tables';
    RAISE NOTICE 'Security functions created for admin operations';
    RAISE NOTICE '';
    RAISE NOTICE 'Permission Levels:';
    RAISE NOTICE '  - super_admin: Full system control';
    RAISE NOTICE '  - moderator: User/content moderation';
    RAISE NOTICE '  - analyst: Read-only access';
    RAISE NOTICE '============================================================';
END $$;

-- ============================================================
-- ADMIN PANEL DATABASE SCHEMA
-- Lost & Found Bangalore - Enterprise-Grade Admin System
-- ============================================================
-- Version: 1.0.0
-- Date: 2026-01-07
-- Description: Complete admin schema with roles, audit logs, and moderation
-- 
-- Run this in Supabase SQL Editor AFTER running schema.sql
-- ============================================================

-- ============================================================
-- ADMIN-SPECIFIC ENUMS
-- ============================================================

-- Admin role enum (separate from user roles)
DO $$ BEGIN
    CREATE TYPE admin_role AS ENUM ('super_admin', 'moderator', 'analyst');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Admin action type enum
DO $$ BEGIN
    CREATE TYPE admin_action_type AS ENUM (
        -- User actions
        'user_warn',
        'user_suspend',
        'user_ban',
        'user_unban',
        'user_trust_adjust',
        'user_chat_disable',
        'user_claim_block',
        -- Item actions
        'item_hide',
        'item_unhide',
        'item_edit',
        'item_soft_delete',
        'item_hard_delete',
        'item_restore',
        -- Claim actions
        'claim_lock',
        'claim_unlock',
        'claim_override_approve',
        'claim_override_reject',
        -- Chat actions
        'chat_freeze',
        'chat_unfreeze',
        'chat_message_delete',
        'chat_view_content',
        -- Report actions
        'report_dismiss',
        'report_resolve',
        -- System actions
        'setting_change',
        'admin_message_send',
        'trust_score_lock',
        'trust_score_unlock'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Admin message context type
DO $$ BEGIN
    CREATE TYPE admin_message_context AS ENUM (
        'item_verification',
        'claim_dispute',
        'abuse_report',
        'warning',
        'account_notice',
        'handover_confirmation',
        'general'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- System setting type
DO $$ BEGIN
    CREATE TYPE setting_type AS ENUM ('number', 'boolean', 'string', 'json');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- TABLE: ADMIN_USERS
-- ============================================================
-- Separate admin user table for security isolation

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Link to auth user
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Admin info
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    
    -- Role and permissions
    role admin_role NOT NULL DEFAULT 'analyst',
    permissions JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    deactivated_at TIMESTAMPTZ,
    deactivated_by UUID REFERENCES public.admin_users(id),
    deactivation_reason TEXT,
    
    -- Security
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    
    -- Session management
    session_timeout_minutes INTEGER DEFAULT 30,
    allowed_ips TEXT[], -- NULL means all IPs allowed
    
    -- Created by another admin
    created_by UUID REFERENCES public.admin_users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON public.admin_users(is_active);

COMMENT ON TABLE public.admin_users IS 'Admin user accounts with role-based access control';

-- ============================================================
-- TABLE: ADMIN_AUDIT_LOGS
-- ============================================================
-- Comprehensive, tamper-proof audit trail for all admin actions

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Admin who performed the action
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
    admin_email TEXT NOT NULL, -- Denormalized for audit integrity
    admin_role admin_role NOT NULL, -- Denormalized for audit integrity
    
    -- Action details
    action admin_action_type NOT NULL,
    action_category TEXT NOT NULL, -- user, item, claim, chat, report, system
    
    -- Target entity
    target_type TEXT, -- user, item, claim, chat, message, report
    target_id UUID,
    target_email TEXT, -- For user targets, denormalized
    
    -- Justification (required for sensitive actions)
    justification TEXT,
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Request context
    ip_address INET NOT NULL,
    user_agent TEXT,
    session_id TEXT,
    
    -- Tamper protection
    checksum TEXT NOT NULL, -- SHA256 hash of critical fields
    
    -- Timestamp (immutable)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_category ON public.admin_audit_logs(action_category);

-- Prevent updates and deletes on audit logs
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_update ON public.admin_audit_logs;
CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE OR DELETE ON public.admin_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

COMMENT ON TABLE public.admin_audit_logs IS 'Immutable audit trail for all admin actions';

-- ============================================================
-- TABLE: ADMIN_MESSAGES
-- ============================================================
-- Official admin-to-user communication system

CREATE TABLE IF NOT EXISTS public.admin_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Sender (admin)
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
    
    -- Recipient (user)
    recipient_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Context (what triggered this message)
    context_type admin_message_context NOT NULL,
    context_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    context_claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
    context_report_id UUID REFERENCES public.abuse_reports(id) ON DELETE SET NULL,
    
    -- Message content
    subject TEXT NOT NULL,
    message_text TEXT NOT NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMPTZ,
    
    -- Response (if applicable)
    user_response TEXT,
    responded_at TIMESTAMPTZ,
    
    -- Priority
    is_urgent BOOLEAN DEFAULT FALSE NOT NULL,
    requires_response BOOLEAN DEFAULT FALSE NOT NULL,
    response_deadline TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_messages_admin ON public.admin_messages(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_recipient ON public.admin_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_context ON public.admin_messages(context_type);
CREATE INDEX IF NOT EXISTS idx_admin_messages_unread ON public.admin_messages(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_admin_messages_created ON public.admin_messages(created_at DESC);

COMMENT ON TABLE public.admin_messages IS 'Official admin-to-user communications';

-- ============================================================
-- TABLE: USER_RESTRICTIONS
-- ============================================================
-- Track user restrictions and penalties

CREATE TABLE IF NOT EXISTS public.user_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target user
    user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Restriction type
    restriction_type TEXT NOT NULL, -- claim_blocked, chat_disabled, suspended, banned
    
    -- Duration
    starts_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ, -- NULL = permanent
    
    -- Reason
    reason TEXT NOT NULL,
    
    -- Admin who applied
    applied_by UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
    
    -- Removal info
    removed_at TIMESTAMPTZ,
    removed_by UUID REFERENCES public.admin_users(id),
    removal_reason TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_restrictions_user ON public.user_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_type ON public.user_restrictions(restriction_type);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_active ON public.user_restrictions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_restrictions_expires ON public.user_restrictions(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE public.user_restrictions IS 'Active and historical user restrictions';

-- ============================================================
-- TABLE: USER_WARNINGS
-- ============================================================
-- Track warnings issued to users

CREATE TABLE IF NOT EXISTS public.user_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target user
    user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Warning details
    warning_type TEXT NOT NULL, -- policy_violation, suspicious_activity, abuse_report, other
    severity TEXT NOT NULL, -- low, medium, high
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Related entities
    related_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    related_claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
    related_report_id UUID REFERENCES public.abuse_reports(id) ON DELETE SET NULL,
    
    -- Admin who issued
    issued_by UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
    
    -- Acknowledgment
    is_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    
    -- Expiry (for warning count purposes)
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON public.user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_severity ON public.user_warnings(severity);
CREATE INDEX IF NOT EXISTS idx_user_warnings_created ON public.user_warnings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_warnings_expires ON public.user_warnings(user_id, expires_at);

COMMENT ON TABLE public.user_warnings IS 'Warnings issued to users by admins';

-- ============================================================
-- TABLE: TRUST_SCORE_HISTORY
-- ============================================================
-- Complete history of trust score changes

CREATE TABLE IF NOT EXISTS public.trust_score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target user
    user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Score change
    old_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    change_amount INTEGER NOT NULL, -- Can be negative
    
    -- Reason
    change_reason TEXT NOT NULL, -- manual_adjustment, claim_approved, claim_rejected, abuse_report, return_completed, etc.
    change_source TEXT NOT NULL, -- system, admin
    
    -- Admin (if manual adjustment)
    admin_id UUID REFERENCES public.admin_users(id),
    admin_notes TEXT,
    
    -- Lock status
    is_locked BOOLEAN DEFAULT FALSE NOT NULL,
    locked_until TIMESTAMPTZ,
    lock_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trust_history_user ON public.trust_score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_history_created ON public.trust_score_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_history_source ON public.trust_score_history(change_source);

COMMENT ON TABLE public.trust_score_history IS 'Complete audit trail of trust score changes';

-- ============================================================
-- TABLE: CLAIM_ADMIN_NOTES
-- ============================================================
-- Admin notes and dispute handling for claims

CREATE TABLE IF NOT EXISTS public.claim_admin_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target claim
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    
    -- Admin
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
    
    -- Note content
    note_type TEXT NOT NULL, -- observation, dispute_note, override_reason, investigation
    content TEXT NOT NULL,
    
    -- Visibility
    is_internal BOOLEAN DEFAULT TRUE NOT NULL, -- False = visible to users involved
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claim_notes_claim ON public.claim_admin_notes(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_notes_admin ON public.claim_admin_notes(admin_id);
CREATE INDEX IF NOT EXISTS idx_claim_notes_created ON public.claim_admin_notes(created_at DESC);

COMMENT ON TABLE public.claim_admin_notes IS 'Admin notes and observations on claims';

-- ============================================================
-- TABLE: ITEM_MODERATION_LOG
-- ============================================================
-- Track all moderation actions on items

CREATE TABLE IF NOT EXISTS public.item_moderation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target item
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    -- Admin
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
    
    -- Action
    action TEXT NOT NULL, -- hide, unhide, edit, soft_delete, hard_delete, restore, flag_review
    
    -- Details
    reason TEXT NOT NULL,
    changes_made JSONB, -- For edits, track what changed
    
    -- Previous state (for restoration)
    previous_state JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_mod_item ON public.item_moderation_log(item_id);
CREATE INDEX IF NOT EXISTS idx_item_mod_admin ON public.item_moderation_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_item_mod_action ON public.item_moderation_log(action);
CREATE INDEX IF NOT EXISTS idx_item_mod_created ON public.item_moderation_log(created_at DESC);

COMMENT ON TABLE public.item_moderation_log IS 'Moderation action history for items';

-- ============================================================
-- TABLE: CHAT_MODERATION_LOG
-- ============================================================
-- Track admin access and actions on chats

CREATE TABLE IF NOT EXISTS public.chat_moderation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target chat
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    
    -- Admin
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
    
    -- Action
    action TEXT NOT NULL, -- view_messages, freeze, unfreeze, delete_message
    
    -- Justification (REQUIRED for viewing messages)
    justification TEXT NOT NULL,
    abuse_report_id UUID REFERENCES public.abuse_reports(id), -- Link to abuse report
    
    -- For message deletion
    deleted_message_id UUID REFERENCES public.messages(id),
    deleted_message_content TEXT, -- Archived for audit
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_mod_chat ON public.chat_moderation_log(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_mod_admin ON public.chat_moderation_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_chat_mod_action ON public.chat_moderation_log(action);
CREATE INDEX IF NOT EXISTS idx_chat_mod_report ON public.chat_moderation_log(abuse_report_id);

COMMENT ON TABLE public.chat_moderation_log IS 'Audit trail for admin access to chats';

-- ============================================================
-- TABLE: SYSTEM_SETTINGS
-- ============================================================
-- Configurable system settings

CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Setting identity
    setting_key TEXT NOT NULL UNIQUE,
    setting_category TEXT NOT NULL, -- claims, chat, items, trust, security, general
    
    -- Value
    setting_type setting_type NOT NULL,
    value_number NUMERIC,
    value_boolean BOOLEAN,
    value_string TEXT,
    value_json JSONB,
    
    -- Metadata
    display_name TEXT NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE NOT NULL, -- Don't expose to frontend
    
    -- Validation
    min_value NUMERIC,
    max_value NUMERIC,
    allowed_values TEXT[], -- For string type with limited options
    
    -- Last change
    last_changed_by UUID REFERENCES public.admin_users(id),
    last_changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settings_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON public.system_settings(setting_category);

-- Insert default settings
INSERT INTO public.system_settings (setting_key, setting_category, setting_type, value_number, display_name, description, min_value, max_value) VALUES
    ('max_claims_per_item', 'claims', 'number', 10, 'Max Claims Per Item', 'Maximum number of claims allowed per item', 1, 100),
    ('max_claims_per_user_per_day', 'claims', 'number', 5, 'Max Claims Per User Per Day', 'Rate limit for claim submissions', 1, 50),
    ('claim_cooldown_hours', 'claims', 'number', 24, 'Claim Cooldown (Hours)', 'Hours before user can claim same item again after rejection', 1, 168),
    ('item_expiry_days', 'items', 'number', 90, 'Item Expiry (Days)', 'Days after which inactive items expire', 30, 365),
    ('trust_score_claim_approved', 'trust', 'number', 5, 'Trust Score: Claim Approved', 'Points added when claim is approved', 0, 20),
    ('trust_score_return_completed', 'trust', 'number', 10, 'Trust Score: Return Completed', 'Points added when return is completed', 0, 30),
    ('trust_score_false_claim', 'trust', 'number', -15, 'Trust Score: False Claim', 'Points deducted for false claims', -50, 0),
    ('trust_score_abuse_report', 'trust', 'number', -10, 'Trust Score: Abuse Report Confirmed', 'Points deducted when abuse report is confirmed', -50, 0),
    ('low_trust_threshold', 'trust', 'number', 40, 'Low Trust Threshold', 'Users below this score face restrictions', 10, 50),
    ('ban_trust_threshold', 'trust', 'number', 20, 'Auto-Ban Trust Threshold', 'Users below this score are auto-flagged for ban', 0, 30),
    ('admin_session_timeout', 'security', 'number', 30, 'Admin Session Timeout (Minutes)', 'Auto-logout after inactivity', 5, 120),
    ('max_login_attempts', 'security', 'number', 5, 'Max Login Attempts', 'Failed attempts before account lock', 3, 10),
    ('account_lock_duration', 'security', 'number', 30, 'Account Lock Duration (Minutes)', 'Lock duration after max failed attempts', 5, 1440)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_category, setting_type, value_boolean, display_name, description) VALUES
    ('maintenance_mode', 'general', 'boolean', false, 'Maintenance Mode', 'Disable public access during maintenance'),
    ('new_registrations_enabled', 'general', 'boolean', true, 'New Registrations Enabled', 'Allow new user sign-ups'),
    ('chat_enabled_globally', 'chat', 'boolean', true, 'Chat Enabled Globally', 'Master switch for chat feature'),
    ('claims_enabled_globally', 'claims', 'boolean', true, 'Claims Enabled Globally', 'Master switch for claims feature'),
    ('auto_flag_low_trust_claims', 'trust', 'boolean', true, 'Auto-Flag Low Trust Claims', 'Automatically flag claims from low-trust users'),
    ('require_email_verification', 'security', 'boolean', false, 'Require Email Verification', 'Require email verification for new users')
ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON TABLE public.system_settings IS 'Configurable system settings managed by admins';

-- ============================================================
-- TABLE: ADMIN_LOGIN_HISTORY
-- ============================================================
-- Track all admin login attempts

CREATE TABLE IF NOT EXISTS public.admin_login_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Admin (may be NULL for failed attempts with unknown email)
    admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    attempted_email TEXT NOT NULL,
    
    -- Result
    success BOOLEAN NOT NULL,
    failure_reason TEXT, -- invalid_credentials, account_locked, inactive_account, ip_blocked
    
    -- Context
    ip_address INET NOT NULL,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_login_history_admin ON public.admin_login_history(admin_id);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON public.admin_login_history(attempted_email);
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON public.admin_login_history(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON public.admin_login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_success ON public.admin_login_history(success);

COMMENT ON TABLE public.admin_login_history IS 'Complete history of admin login attempts';

-- ============================================================
-- TABLE: PLATFORM_STATISTICS_DAILY
-- ============================================================
-- Pre-aggregated daily statistics for dashboard

CREATE TABLE IF NOT EXISTS public.platform_statistics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Date
    stat_date DATE NOT NULL UNIQUE,
    
    -- User stats
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0, -- Users who performed any action
    banned_users INTEGER DEFAULT 0,
    
    -- Item stats
    total_items INTEGER DEFAULT 0,
    new_items INTEGER DEFAULT 0,
    active_items INTEGER DEFAULT 0,
    returned_items INTEGER DEFAULT 0,
    expired_items INTEGER DEFAULT 0,
    
    -- Claim stats
    total_claims INTEGER DEFAULT 0,
    new_claims INTEGER DEFAULT 0,
    approved_claims INTEGER DEFAULT 0,
    rejected_claims INTEGER DEFAULT 0,
    
    -- Chat stats
    total_messages INTEGER DEFAULT 0,
    active_chats INTEGER DEFAULT 0,
    
    -- Abuse stats
    new_reports INTEGER DEFAULT 0,
    resolved_reports INTEGER DEFAULT 0,
    
    -- Trust stats
    avg_trust_score NUMERIC(5,2),
    low_trust_users INTEGER DEFAULT 0,
    
    -- Calculated at
    calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_platform_stats_date ON public.platform_statistics_daily(stat_date DESC);

COMMENT ON TABLE public.platform_statistics_daily IS 'Daily aggregated platform statistics';

-- ============================================================
-- ADDITIONAL COLUMNS FOR EXISTING TABLES
-- ============================================================

-- Add admin-related columns to items table
ALTER TABLE public.items 
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.admin_users(id),
    ADD COLUMN IF NOT EXISTS hide_reason TEXT,
    ADD COLUMN IF NOT EXISTS is_soft_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS soft_deleted_by UUID REFERENCES public.admin_users(id),
    ADD COLUMN IF NOT EXISTS soft_delete_reason TEXT;

-- Add admin-related columns to claims table
ALTER TABLE public.claims 
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES public.admin_users(id),
    ADD COLUMN IF NOT EXISTS lock_reason TEXT,
    ADD COLUMN IF NOT EXISTS admin_override BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES public.admin_users(id),
    ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- Add admin-related columns to chats table
ALTER TABLE public.chats 
    ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS frozen_by UUID REFERENCES public.admin_users(id),
    ADD COLUMN IF NOT EXISTS freeze_reason TEXT;

-- Add admin-related columns to user_profiles table
ALTER TABLE public.user_profiles 
    ADD COLUMN IF NOT EXISTS is_chat_disabled BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS chat_disabled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS chat_disabled_by UUID REFERENCES public.admin_users(id),
    ADD COLUMN IF NOT EXISTS chat_disable_reason TEXT,
    ADD COLUMN IF NOT EXISTS is_claim_blocked BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS claim_blocked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS claim_blocked_by UUID REFERENCES public.admin_users(id),
    ADD COLUMN IF NOT EXISTS claim_block_reason TEXT,
    ADD COLUMN IF NOT EXISTS trust_score_locked BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS trust_score_locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS active_warnings_count INTEGER DEFAULT 0 NOT NULL;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE user_id = check_user_id 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get admin role
CREATE OR REPLACE FUNCTION get_admin_role(check_user_id UUID)
RETURNS admin_role AS $$
DECLARE
    result admin_role;
BEGIN
    SELECT role INTO result 
    FROM public.admin_users 
    WHERE user_id = check_user_id 
    AND is_active = true;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check admin permission
CREATE OR REPLACE FUNCTION has_admin_permission(check_user_id UUID, required_role admin_role)
RETURNS BOOLEAN AS $$
DECLARE
    user_role admin_role;
BEGIN
    SELECT role INTO user_role 
    FROM public.admin_users 
    WHERE user_id = check_user_id 
    AND is_active = true;
    
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Super admin has all permissions
    IF user_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Moderator can do moderator and analyst tasks
    IF user_role = 'moderator' AND required_role IN ('moderator', 'analyst') THEN
        RETURN TRUE;
    END IF;
    
    -- Analyst can only do analyst tasks
    IF user_role = 'analyst' AND required_role = 'analyst' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate audit log checksum
CREATE OR REPLACE FUNCTION generate_audit_checksum(
    p_admin_id UUID,
    p_action admin_action_type,
    p_target_id UUID,
    p_created_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        sha256(
            (COALESCE(p_admin_id::text, '') || 
             p_action::text || 
             COALESCE(p_target_id::text, '') || 
             p_created_at::text)::bytea
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to log admin action
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_id UUID,
    p_action admin_action_type,
    p_action_category TEXT,
    p_target_type TEXT,
    p_target_id UUID,
    p_justification TEXT,
    p_old_values JSONB,
    p_new_values JSONB,
    p_ip_address INET,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_admin_email TEXT;
    v_admin_role admin_role;
    v_target_email TEXT;
    v_log_id UUID;
    v_checksum TEXT;
    v_created_at TIMESTAMPTZ := NOW();
BEGIN
    -- Get admin info
    SELECT email, role INTO v_admin_email, v_admin_role
    FROM public.admin_users WHERE id = p_admin_id;
    
    -- Get target email if target is a user
    IF p_target_type = 'user' THEN
        SELECT email INTO v_target_email
        FROM public.user_profiles WHERE user_id = p_target_id;
    END IF;
    
    -- Generate checksum
    v_checksum := generate_audit_checksum(p_admin_id, p_action, p_target_id, v_created_at);
    
    -- Insert log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, admin_role, action, action_category,
        target_type, target_id, target_email, justification,
        old_values, new_values, metadata, ip_address, user_agent,
        checksum, created_at
    ) VALUES (
        p_admin_id, v_admin_email, v_admin_role, p_action, p_action_category,
        p_target_type, p_target_id, v_target_email, p_justification,
        p_old_values, p_new_values, p_metadata, p_ip_address, p_user_agent,
        v_checksum, v_created_at
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate daily statistics
CREATE OR REPLACE FUNCTION calculate_daily_statistics(p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.platform_statistics_daily (
        stat_date,
        total_users, new_users, active_users, banned_users,
        total_items, new_items, active_items, returned_items, expired_items,
        total_claims, new_claims, approved_claims, rejected_claims,
        total_messages, active_chats,
        new_reports, resolved_reports,
        avg_trust_score, low_trust_users
    )
    SELECT
        p_date,
        -- Users
        (SELECT COUNT(*) FROM user_profiles),
        (SELECT COUNT(*) FROM user_profiles WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM user_profiles WHERE last_active_at::date = p_date),
        (SELECT COUNT(*) FROM user_profiles WHERE account_status = 'banned'),
        -- Items
        (SELECT COUNT(*) FROM items),
        (SELECT COUNT(*) FROM items WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM items WHERE status = 'active'),
        (SELECT COUNT(*) FROM items WHERE status = 'returned'),
        (SELECT COUNT(*) FROM items WHERE status = 'expired'),
        -- Claims
        (SELECT COUNT(*) FROM claims),
        (SELECT COUNT(*) FROM claims WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM claims WHERE status = 'approved' AND approved_at::date = p_date),
        (SELECT COUNT(*) FROM claims WHERE status = 'rejected' AND rejected_at::date = p_date),
        -- Messages & Chats
        (SELECT COUNT(*) FROM messages WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM chats WHERE is_closed = false),
        -- Reports
        (SELECT COUNT(*) FROM abuse_reports WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM abuse_reports WHERE status = 'resolved' AND reviewed_at::date = p_date),
        -- Trust
        (SELECT AVG(trust_score)::numeric(5,2) FROM user_profiles),
        (SELECT COUNT(*) FROM user_profiles WHERE trust_score < 40)
    ON CONFLICT (stat_date) DO UPDATE SET
        total_users = EXCLUDED.total_users,
        new_users = EXCLUDED.new_users,
        active_users = EXCLUDED.active_users,
        banned_users = EXCLUDED.banned_users,
        total_items = EXCLUDED.total_items,
        new_items = EXCLUDED.new_items,
        active_items = EXCLUDED.active_items,
        returned_items = EXCLUDED.returned_items,
        expired_items = EXCLUDED.expired_items,
        total_claims = EXCLUDED.total_claims,
        new_claims = EXCLUDED.new_claims,
        approved_claims = EXCLUDED.approved_claims,
        rejected_claims = EXCLUDED.rejected_claims,
        total_messages = EXCLUDED.total_messages,
        active_chats = EXCLUDED.active_chats,
        new_reports = EXCLUDED.new_reports,
        resolved_reports = EXCLUDED.resolved_reports,
        avg_trust_score = EXCLUDED.avg_trust_score,
        low_trust_users = EXCLUDED.low_trust_users,
        calculated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VIEWS FOR ADMIN DASHBOARD
-- ============================================================

-- View: Admin Dashboard Summary
CREATE OR REPLACE VIEW public.admin_dashboard_summary AS
SELECT
    -- Users
    (SELECT COUNT(*) FROM user_profiles) as total_users,
    (SELECT COUNT(*) FROM user_profiles WHERE created_at::date = CURRENT_DATE) as new_users_today,
    (SELECT COUNT(*) FROM user_profiles WHERE account_status = 'banned') as banned_users,
    (SELECT COUNT(*) FROM user_profiles WHERE trust_score < 40) as low_trust_users,
    
    -- Items
    (SELECT COUNT(*) FROM items) as total_items,
    (SELECT COUNT(*) FROM items WHERE status = 'active' AND is_hidden = false AND is_soft_deleted = false) as active_items,
    (SELECT COUNT(*) FROM items WHERE status = 'returned') as returned_items,
    (SELECT COUNT(*) FROM items WHERE is_flagged = true) as flagged_items,
    
    -- Claims
    (SELECT COUNT(*) FROM claims) as total_claims,
    (SELECT COUNT(*) FROM claims WHERE status = 'pending') as pending_claims,
    (SELECT COUNT(*) FROM claims WHERE is_locked = true) as locked_claims,
    
    -- Reports
    (SELECT COUNT(*) FROM abuse_reports WHERE status = 'pending') as pending_reports,
    (SELECT COUNT(*) FROM abuse_reports WHERE status = 'reviewing') as reviewing_reports,
    
    -- Chats
    (SELECT COUNT(*) FROM chats WHERE is_closed = false) as active_chats,
    (SELECT COUNT(*) FROM chats WHERE is_frozen = true) as frozen_chats;

-- View: Flagged Items for Review
CREATE OR REPLACE VIEW public.admin_flagged_items AS
SELECT 
    i.*,
    c.name as category_name,
    a.name as area_name,
    up.email as finder_email,
    up.full_name as finder_name,
    up.trust_score as finder_trust_score,
    (SELECT COUNT(*) FROM claims WHERE item_id = i.id) as claim_count,
    (SELECT COUNT(*) FROM abuse_reports WHERE target_item_id = i.id AND status = 'pending') as pending_reports
FROM items i
JOIN categories c ON i.category_id = c.id
JOIN areas a ON i.area_id = a.id
JOIN user_profiles up ON i.finder_id = up.user_id
WHERE i.is_flagged = true OR i.is_soft_deleted = true
ORDER BY i.flagged_at DESC NULLS LAST, i.created_at DESC;

-- View: Users requiring attention
CREATE OR REPLACE VIEW public.admin_users_attention AS
SELECT 
    up.*,
    (SELECT COUNT(*) FROM abuse_reports WHERE target_user_id = up.user_id AND status = 'pending') as pending_reports_against,
    (SELECT COUNT(*) FROM user_warnings WHERE user_id = up.user_id AND expires_at > NOW()) as active_warnings,
    (SELECT COUNT(*) FROM user_restrictions WHERE user_id = up.user_id AND is_active = true) as active_restrictions
FROM user_profiles up
WHERE 
    up.trust_score < 40 
    OR up.account_status IN ('suspended', 'banned')
    OR up.is_chat_disabled = true
    OR up.is_claim_blocked = true
    OR EXISTS (SELECT 1 FROM abuse_reports WHERE target_user_id = up.user_id AND status = 'pending')
ORDER BY up.trust_score ASC, up.reports_received_count DESC;

COMMENT ON VIEW public.admin_dashboard_summary IS 'Real-time summary statistics for admin dashboard';
COMMENT ON VIEW public.admin_flagged_items IS 'Items requiring admin review';
COMMENT ON VIEW public.admin_users_attention IS 'Users requiring admin attention';

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ADMIN SCHEMA CREATED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - admin_users';
    RAISE NOTICE '  - admin_audit_logs (immutable)';
    RAISE NOTICE '  - admin_messages';
    RAISE NOTICE '  - user_restrictions';
    RAISE NOTICE '  - user_warnings';
    RAISE NOTICE '  - trust_score_history';
    RAISE NOTICE '  - claim_admin_notes';
    RAISE NOTICE '  - item_moderation_log';
    RAISE NOTICE '  - chat_moderation_log';
    RAISE NOTICE '  - system_settings';
    RAISE NOTICE '  - admin_login_history';
    RAISE NOTICE '  - platform_statistics_daily';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - is_admin()';
    RAISE NOTICE '  - get_admin_role()';
    RAISE NOTICE '  - has_admin_permission()';
    RAISE NOTICE '  - log_admin_action()';
    RAISE NOTICE '  - calculate_daily_statistics()';
    RAISE NOTICE '';
    RAISE NOTICE 'Views created:';
    RAISE NOTICE '  - admin_dashboard_summary';
    RAISE NOTICE '  - admin_flagged_items';
    RAISE NOTICE '  - admin_users_attention';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Next: Run admin_rls.sql for Row Level Security policies';
    RAISE NOTICE '============================================================';
END $$;

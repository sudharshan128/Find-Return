-- ============================================================
-- ADMIN SCHEMA SETUP
-- Lost & Found Bangalore - Admin Infrastructure
-- ============================================================
-- Version: 1.0.0
-- Date: 2026-01-07
-- Description: Creates admin tables, types, and helper functions
-- 
-- Run this FIRST before running admin_rls.sql
-- ============================================================

-- ============================================================
-- CREATE ENUMS (Drop if exists first)
-- ============================================================

-- Drop tables first (before dropping types, to avoid CASCADE issues)
DROP TABLE IF EXISTS public.platform_statistics_daily CASCADE;
DROP TABLE IF EXISTS public.admin_login_history CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.chat_moderation_log CASCADE;
DROP TABLE IF EXISTS public.item_moderation_log CASCADE;
DROP TABLE IF EXISTS public.claim_admin_notes CASCADE;
DROP TABLE IF EXISTS public.trust_score_history CASCADE;
DROP TABLE IF EXISTS public.user_warnings CASCADE;
DROP TABLE IF EXISTS public.user_restrictions CASCADE;
DROP TABLE IF EXISTS public.admin_messages CASCADE;
DROP TABLE IF EXISTS public.admin_audit_logs CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;

-- Now drop the types
DROP TYPE IF EXISTS public.admin_role CASCADE;
DROP TYPE IF EXISTS public.account_status CASCADE;
DROP TYPE IF EXISTS public.restriction_type CASCADE;

CREATE TYPE public.admin_role AS ENUM ('super_admin', 'moderator', 'analyst');
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE public.restriction_type AS ENUM ('warning', 'suspended', 'banned');

-- ============================================================
-- CREATE ADMIN TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role admin_role NOT NULL DEFAULT 'analyst',
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID,
  deactivation_reason TEXT,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  session_timeout_minutes INTEGER DEFAULT 30,
  allowed_ips INET[],
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  force_logout_at TIMESTAMPTZ,
  force_logout_reason TEXT,
  session_revoked_at TIMESTAMPTZ,
  twofa_enabled BOOLEAN DEFAULT false,
  twofa_secret TEXT,
  twofa_verified_at TIMESTAMPTZ,
  twofa_backup_codes TEXT[]
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admin_users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_action TEXT NOT NULL,
  resource_id TEXT,
  reason TEXT,
  before_data JSONB,
  after_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_admin_id UUID NOT NULL REFERENCES public.admin_users(id),
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  restriction_type restriction_type NOT NULL,
  reason TEXT NOT NULL,
  applied_by UUID NOT NULL REFERENCES public.admin_users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  warning_type TEXT NOT NULL,
  description TEXT NOT NULL,
  issued_by UUID NOT NULL REFERENCES public.admin_users(id),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trust_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  old_score INTEGER,
  new_score INTEGER NOT NULL,
  change_amount INTEGER,
  change_reason TEXT,
  change_source TEXT DEFAULT 'system',
  admin_id UUID REFERENCES public.admin_users(id),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.claim_admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL,
  admin_id UUID NOT NULL REFERENCES public.admin_users(id),
  note TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.item_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  admin_id UUID NOT NULL REFERENCES public.admin_users(id),
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  admin_id UUID NOT NULL REFERENCES public.admin_users(id),
  action TEXT NOT NULL,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.admin_users(id),
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  failure_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  login_method TEXT DEFAULT 'oauth',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_statistics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_users INTEGER,
  new_users_today INTEGER,
  active_users_today INTEGER,
  total_items INTEGER,
  new_items_today INTEGER,
  total_claims INTEGER,
  completed_claims_today INTEGER,
  banned_users INTEGER,
  low_trust_users INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HELPER FUNCTIONS FOR ADMIN CHECKS
-- ============================================================

-- Drop existing functions first (handles parameter name changes)
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_admin_permission(uuid, admin_role) CASCADE;
DROP FUNCTION IF EXISTS public.log_admin_action(uuid, text, text, text, text, text, jsonb, jsonb, inet) CASCADE;

-- Function: Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.admin_users
    WHERE user_id = $1 AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Check admin permissions
CREATE OR REPLACE FUNCTION public.has_admin_permission(user_id UUID, required_role admin_role)
RETURNS BOOLEAN AS $$
DECLARE
  admin_role_val admin_role;
BEGIN
  SELECT role INTO admin_role_val FROM public.admin_users
  WHERE user_id = $1 AND is_active = true;
  
  IF admin_role_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Role hierarchy: super_admin > moderator > analyst
  CASE required_role
    WHEN 'super_admin' THEN
      RETURN admin_role_val = 'super_admin';
    WHEN 'moderator' THEN
      RETURN admin_role_val IN ('super_admin', 'moderator');
    WHEN 'analyst' THEN
      RETURN admin_role_val IN ('super_admin', 'moderator', 'analyst');
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Log admin action
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_action TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_before_data JSONB DEFAULT NULL,
  p_after_data JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    resource_type,
    resource_action,
    resource_id,
    reason,
    before_data,
    after_data,
    ip_address
  ) VALUES (
    p_admin_id,
    p_action,
    p_resource_type,
    p_resource_action,
    p_resource_id,
    p_reason,
    p_before_data,
    p_after_data,
    p_ip_address
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_user_id ON public.user_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_user_id ON public.user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_score_history_user_id ON public.trust_score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_recipient_id ON public.admin_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_history_email ON public.admin_login_history(email);
CREATE INDEX IF NOT EXISTS idx_admin_login_history_created_at ON public.admin_login_history(created_at);

-- ============================================================
-- SCHEMA SETUP COMPLETE
-- ============================================================
-- All admin tables, enums, and helper functions created successfully.
-- Next step: Run admin_rls.sql to set up RLS policies

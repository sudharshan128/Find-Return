-- ============================================================
-- PHASE 2 SECURITY HARDENING: Session Management Migration
-- Run this to add force logout and session revocation support
-- ============================================================
-- 
-- PREREQUISITE: Run admin_schema.sql first to create admin_users table
-- If admin_users doesn't exist, this script will skip those alterations
-- ============================================================

-- ============================================================
-- SAFETY CHECK: Verify admin_users exists
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_users') THEN
    RAISE EXCEPTION 'Table admin_users does not exist. Please run admin_schema.sql first.';
  END IF;
END $$;

-- Add force logout columns to admin_users
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS force_logout_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS session_revoked_at TIMESTAMPTZ DEFAULT NULL;

-- Add user_agent column to login history if not exists
ALTER TABLE admin_login_history 
ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT NULL;

-- Create index for faster session revocation checks
CREATE INDEX IF NOT EXISTS idx_admin_users_force_logout 
ON admin_users (force_logout_at) 
WHERE force_logout_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN admin_users.force_logout_at IS 'Timestamp when admin was force logged out. Sessions started before this time are invalid.';
COMMENT ON COLUMN admin_users.force_logout_reason IS 'Reason for force logout (for audit purposes)';
COMMENT ON COLUMN admin_users.session_revoked_at IS 'Timestamp when all sessions were revoked';

-- ============================================================
-- RATE LIMITING TABLE (Server-side rate limiting)
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL, -- e.g., 'login:user@email.com' or 'action:admin_id'
  attempts INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON admin_rate_limits (key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON admin_rate_limits (blocked_until) WHERE blocked_until IS NOT NULL;

-- Auto-cleanup old rate limit entries (keep for 1 hour after window)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_rate_limits 
  WHERE updated_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SESSION TRACKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token_hash VARCHAR(64), -- Hash of session token for verification
  ip_address INET,
  user_agent TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ DEFAULT NULL,
  revoked_by UUID REFERENCES admin_users(id) DEFAULT NULL,
  revoke_reason TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for session management
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions (admin_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at);

-- RLS for sessions table
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can see their own sessions
CREATE POLICY admin_sessions_view ON admin_sessions
  FOR SELECT
  USING (
    admin_id IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Only super_admin can modify sessions
CREATE POLICY admin_sessions_modify ON admin_sessions
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================
-- FUNCTION: Check if session is valid
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin_session_valid(p_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_force_logout_at TIMESTAMPTZ;
  v_session_start TIMESTAMPTZ;
BEGIN
  -- Get force logout timestamp
  SELECT force_logout_at INTO v_force_logout_at
  FROM admin_users
  WHERE id = p_admin_id;
  
  -- If force logout is set and recent (within last hour), session is invalid
  IF v_force_logout_at IS NOT NULL AND v_force_logout_at > NOW() - INTERVAL '1 hour' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Force logout admin
-- ============================================================

CREATE OR REPLACE FUNCTION force_logout_admin(
  p_target_admin_id UUID,
  p_reason TEXT DEFAULT 'Administrative action'
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  -- Get caller info
  SELECT id, role INTO v_caller_id, v_caller_role
  FROM admin_users
  WHERE user_id = auth.uid();
  
  -- Only super_admin can force logout
  IF v_caller_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can force logout users');
  END IF;
  
  -- Update target admin
  UPDATE admin_users
  SET 
    force_logout_at = NOW(),
    force_logout_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_target_admin_id;
  
  -- Revoke all active sessions
  UPDATE admin_sessions
  SET 
    is_active = FALSE,
    revoked_at = NOW(),
    revoked_by = v_caller_id,
    revoke_reason = p_reason
  WHERE admin_id = p_target_admin_id AND is_active = TRUE;
  
  -- Log the action
  INSERT INTO admin_audit_logs (
    admin_id, admin_email, admin_role, action, action_category,
    target_type, target_id, justification, metadata
  )
  SELECT 
    v_caller_id, 
    (SELECT email FROM admin_users WHERE id = v_caller_id),
    v_caller_role,
    'force_logout_admin',
    'security',
    'admin_user',
    p_target_admin_id,
    p_reason,
    jsonb_build_object(
      'target_email', (SELECT email FROM admin_users WHERE id = p_target_admin_id),
      'severity', 'high'
    );
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Emergency - Force logout all admins
-- ============================================================

CREATE OR REPLACE FUNCTION emergency_force_logout_all(
  p_reason TEXT DEFAULT 'Emergency security action'
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_affected_count INTEGER;
BEGIN
  -- Get caller info
  SELECT id, role INTO v_caller_id, v_caller_role
  FROM admin_users
  WHERE user_id = auth.uid();
  
  -- Only super_admin can do emergency logout
  IF v_caller_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can perform emergency logout');
  END IF;
  
  -- Update all admins except caller
  UPDATE admin_users
  SET 
    force_logout_at = NOW(),
    force_logout_reason = 'EMERGENCY: ' || p_reason,
    updated_at = NOW()
  WHERE id != v_caller_id;
  
  GET DIAGNOSTICS v_affected_count = ROW_COUNT;
  
  -- Revoke all sessions except caller's
  UPDATE admin_sessions
  SET 
    is_active = FALSE,
    revoked_at = NOW(),
    revoked_by = v_caller_id,
    revoke_reason = 'EMERGENCY: ' || p_reason
  WHERE admin_id != v_caller_id AND is_active = TRUE;
  
  -- Log the emergency action
  INSERT INTO admin_audit_logs (
    admin_id, admin_email, admin_role, action, action_category,
    target_type, justification, metadata
  )
  SELECT 
    v_caller_id, 
    (SELECT email FROM admin_users WHERE id = v_caller_id),
    v_caller_role,
    'emergency_force_logout_all',
    'security',
    'system',
    p_reason,
    jsonb_build_object(
      'affected_count', v_affected_count,
      'severity', 'critical',
      'emergency', true
    );
  
  RETURN jsonb_build_object('success', true, 'affected_count', v_affected_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin_session_valid(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION force_logout_admin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION emergency_force_logout_all(TEXT) TO authenticated;

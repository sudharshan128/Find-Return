-- ========================================
-- PHASE 3: TWO-FACTOR AUTHENTICATION
-- Migration: 006_add_2fa_support.sql
-- ========================================
-- SAFE: Additive only, no data loss
-- Applied: 2026-01-08
-- Rollback: Run 006_rollback.sql

-- Step 1: Add 2FA columns to admin_users
ALTER TABLE admin_users
ADD COLUMN twofa_enabled boolean DEFAULT false,
ADD COLUMN twofa_secret text,
ADD COLUMN twofa_verified_at timestamp with time zone,
ADD COLUMN twofa_backup_codes text[];

-- Add comments for documentation
COMMENT ON COLUMN admin_users.twofa_enabled IS 'Whether 2FA is enabled for this admin';
COMMENT ON COLUMN admin_users.twofa_secret IS 'ENCRYPTED: TOTP base32 secret for Google Authenticator';
COMMENT ON COLUMN admin_users.twofa_verified_at IS 'Timestamp when 2FA was verified/enabled';
COMMENT ON COLUMN admin_users.twofa_backup_codes IS 'ENCRYPTED: One-time recovery codes (future use)';

-- Step 2: Create table for 2FA rate limiting
CREATE TABLE IF NOT EXISTS public.twofa_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamp with time zone DEFAULT now(),
  locked_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_twofa_attempts_admin_id ON public.twofa_attempts(admin_id);
CREATE INDEX IF NOT EXISTS idx_twofa_attempts_locked_until ON public.twofa_attempts(locked_until);

-- Step 3: Update admin_audit_logs comment (should already exist)
COMMENT ON TABLE public.admin_audit_logs IS 'Audit trail for all admin actions including 2FA setup/verify/disable';

-- Verification queries (run after migration):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'admin_users' ORDER BY ordinal_position;
-- SELECT * FROM information_schema.tables WHERE table_name = 'twofa_attempts';

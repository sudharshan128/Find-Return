-- ============================================================
-- FIX: Add missing 2FA columns and admin_login_history table
-- Run this to fix schema mismatches with backend code
-- ============================================================

-- Add 2FA columns to admin_users if they don't exist
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS twofa_secret TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS twofa_verified_at TIMESTAMPTZ DEFAULT NULL;

-- Create admin_login_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.admin_login_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    admin_email TEXT NOT NULL,
    login_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    logout_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE NOT NULL,
    failure_reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_login_history_admin_id ON public.admin_login_history(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_history_login_at ON public.admin_login_history(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_login_history_admin_email ON public.admin_login_history(admin_email);

COMMENT ON TABLE public.admin_login_history IS 'Login/logout history for admin users';
COMMENT ON COLUMN public.admin_login_history.admin_email IS 'Denormalized for audit trail';

-- ============================================================
-- FIX: Ensure correct data types for audit logs
-- ============================================================

-- Update admin_audit_logs table to ensure it has all required columns
ALTER TABLE public.admin_audit_logs
ADD COLUMN IF NOT EXISTS admin_email TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN public.admin_audit_logs.admin_email IS 'Denormalized from admin_users for audit integrity';
COMMENT ON COLUMN public.admin_audit_logs.admin_role IS 'Denormalized from admin_users for audit integrity';

-- ============================================================
-- VERIFICATION: Check all required columns exist
-- ============================================================

-- This query lists all expected columns in admin_users
DO $$
DECLARE
    missing_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Check each required column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'id') THEN
        missing_cols := array_append(missing_cols, 'id');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'user_id') THEN
        missing_cols := array_append(missing_cols, 'user_id');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'email') THEN
        missing_cols := array_append(missing_cols, 'email');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'role') THEN
        missing_cols := array_append(missing_cols, 'role');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'is_active') THEN
        missing_cols := array_append(missing_cols, 'is_active');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'twofa_enabled') THEN
        missing_cols := array_append(missing_cols, 'twofa_enabled (JUST ADDED)');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'force_logout_at') THEN
        missing_cols := array_append(missing_cols, 'force_logout_at (from migration)');
    END IF;
    
    IF array_length(missing_cols, 1) > 0 THEN
        RAISE NOTICE 'WARNING: Missing columns in admin_users: %', missing_cols;
    ELSE
        RAISE NOTICE 'SUCCESS: All required columns exist in admin_users';
    END IF;
END $$;

-- Verify admin_login_history exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_login_history') THEN
        RAISE NOTICE 'SUCCESS: admin_login_history table exists';
    ELSE
        RAISE NOTICE 'WARNING: admin_login_history table does not exist';
    END IF;
END $$;

COMMENT ON TABLE public.admin_login_history IS 'Admin login/logout history for security audit';

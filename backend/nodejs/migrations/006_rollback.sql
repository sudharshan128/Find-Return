-- ========================================
-- ROLLBACK: TWO-FACTOR AUTHENTICATION
-- Migration: 006_rollback.sql
-- ========================================
-- SAFE: Only removes 2FA columns/tables
-- Preserves: All audit logs, admin data

-- Step 1: Drop 2FA rate limiting table
DROP TABLE IF EXISTS public.twofa_attempts CASCADE;

-- Step 2: Remove 2FA columns from admin_users
ALTER TABLE admin_users
DROP COLUMN IF EXISTS twofa_enabled,
DROP COLUMN IF EXISTS twofa_secret,
DROP COLUMN IF EXISTS twofa_verified_at,
DROP COLUMN IF EXISTS twofa_backup_codes;

-- Step 3: Verify rollback
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name LIKE 'twofa%';
-- Should return: 0 rows

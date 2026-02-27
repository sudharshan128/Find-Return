-- ============================================================
-- FIX: Admin "Unauthorized" after 2-3 logins
-- force_logout_at is set to a past time, permanently blocking login
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Check current state of all admin_users
SELECT id, email, role, is_active, force_logout_at, session_revoked_at, updated_at
FROM admin_users
ORDER BY updated_at DESC;

-- STEP 2: Clear force_logout_at for ALL admin users
-- (safe to run — only blocks login when set to a past timestamp)
UPDATE admin_users
SET force_logout_at = NULL,
    session_revoked_at = NULL,
    updated_at = NOW()
WHERE force_logout_at IS NOT NULL
   OR session_revoked_at IS NOT NULL;

-- STEP 3: Ensure your super admin account is active
UPDATE admin_users
SET is_active = true,
    updated_at = NOW()
WHERE role = 'super_admin';

-- STEP 4: Verify fix
SELECT email, role, is_active, force_logout_at, session_revoked_at
FROM admin_users
ORDER BY role;

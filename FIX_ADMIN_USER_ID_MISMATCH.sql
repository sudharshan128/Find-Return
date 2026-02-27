-- ============================================================
-- DIAGNOSE & FIX: Admin login "isAuthenticated: false"
-- Root cause: admin_users.user_id doesn't match auth.users.id
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: See all admin_users and whether they have a matching auth user
SELECT
  au.id         AS admin_users_id,
  au.email      AS admin_email,
  au.role,
  au.is_active,
  au.user_id    AS stored_user_id,
  u.id          AS actual_auth_id,
  CASE
    WHEN u.id IS NULL         THEN '❌ NO AUTH USER FOUND FOR THIS EMAIL'
    WHEN au.user_id = u.id    THEN '✅ user_id matches'
    WHEN au.user_id IS NULL   THEN '⚠️ user_id IS NULL — needs fix'
    ELSE                           '❌ user_id MISMATCH — needs fix'
  END           AS status
FROM admin_users au
LEFT JOIN auth.users u ON lower(u.email) = lower(au.email)
ORDER BY au.updated_at DESC;

-- ============================================================
-- STEP 2: AUTO-FIX — update admin_users.user_id to match auth.users.id
-- This fixes the case where user_id is NULL or wrong UUID
-- ============================================================
UPDATE admin_users au
SET
  user_id    = u.id,
  is_active  = true,
  force_logout_at     = NULL,
  session_revoked_at  = NULL,
  updated_at = NOW()
FROM auth.users u
WHERE lower(au.email) = lower(u.email)
  AND (au.user_id IS NULL OR au.user_id != u.id);

-- ============================================================
-- STEP 3: Make sure all admins are fully active
-- ============================================================
UPDATE admin_users
SET
  is_active           = true,
  force_logout_at     = NULL,
  session_revoked_at  = NULL,
  updated_at          = NOW()
WHERE is_active = false
   OR force_logout_at IS NOT NULL
   OR session_revoked_at IS NOT NULL;

-- ============================================================
-- STEP 4: Verify the fix
-- All rows should now show "✅ user_id matches"
-- ============================================================
SELECT
  au.email,
  au.role,
  au.is_active,
  au.user_id    AS stored_user_id,
  u.id          AS actual_auth_id,
  CASE
    WHEN u.id IS NULL      THEN '❌ NO AUTH USER — Google account may not have logged in yet'
    WHEN au.user_id = u.id THEN '✅ user_id matches — login should work'
    ELSE                        '❌ STILL MISMATCHED'
  END AS status
FROM admin_users au
LEFT JOIN auth.users u ON lower(u.email) = lower(au.email)
ORDER BY au.role;

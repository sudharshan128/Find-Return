-- ============================================================
-- FIX: Block user real-time + Admin settings loading
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- PART 1: Enable real-time for blocked_users table
-- (required for instant block detection in chat)
-- ============================================================

-- Add blocked_users to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;

-- Ensure RLS is enabled
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Drop old policies and recreate clean ones
DROP POLICY IF EXISTS "blocked_users_select" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_insert" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_delete" ON public.blocked_users;

-- Users can see their own block records (both as blocker and blocked)
-- This is needed for real-time events to be delivered
CREATE POLICY "blocked_users_select"
ON public.blocked_users FOR SELECT
TO authenticated
USING (
  blocker_id = auth.uid() OR blocked_id = auth.uid()
);

-- Users can only block others (insert as blocker)
CREATE POLICY "blocked_users_insert"
ON public.blocked_users FOR INSERT
TO authenticated
WITH CHECK (blocker_id = auth.uid());

-- Users can only unblock someone they blocked
CREATE POLICY "blocked_users_delete"
ON public.blocked_users FOR DELETE
TO authenticated
USING (blocker_id = auth.uid());

-- PART 2: Fix admin settings loading
-- Ensure system_settings table exists and has data
-- ============================================================

-- Check if system_settings table has data
SELECT setting_key, setting_type, setting_value, description
FROM system_settings
ORDER BY setting_key
LIMIT 20;

-- If system_settings is empty, seed with defaults
INSERT INTO system_settings (setting_key, setting_type, setting_value, description)
VALUES
  ('max_items_per_user',   'number',  '10',   'Maximum items a user can post at once'),
  ('max_images_per_item',  'number',  '5',    'Maximum images per item'),
  ('allow_registration',   'boolean', 'true', 'Allow new user registrations'),
  ('require_email_verify', 'boolean', 'true', 'Require email verification'),
  ('trust_score_min_claim','number',  '30',   'Minimum trust score to submit a claim'),
  ('items_per_page',       'number',  '20',   'Number of items per page'),
  ('chat_enabled',         'boolean', 'true', 'Enable chat functionality'),
  ('maintenance_mode',     'boolean', 'false','Put site in maintenance mode')
ON CONFLICT (setting_key) DO NOTHING;

-- PART 3: Clear admin force_logout_at (if not already done)
-- ============================================================
UPDATE admin_users
SET force_logout_at = NULL,
    session_revoked_at = NULL,
    updated_at = NOW()
WHERE force_logout_at IS NOT NULL
   OR session_revoked_at IS NOT NULL;

-- PART 4: Verify
-- ============================================================
SELECT 'blocked_users realtime' AS check_name,
       COUNT(*) > 0 AS passes
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'blocked_users'

UNION ALL

SELECT 'system_settings has data',
       COUNT(*) > 0
FROM system_settings;

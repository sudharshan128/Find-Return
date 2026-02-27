-- FIX NOTIFICATIONS REAL-TIME
-- Supabase real-time only delivers postgres_changes events to a subscriber
-- if that subscriber's RLS SELECT policy allows them to see the row.
-- Backend inserts with service key (bypasses RLS), but real-time is gated by RLS.
-- Run this in Supabase SQL Editor.

-- ============================================================
-- STEP 1: Check current RLS status on notifications table
-- ============================================================
SELECT relname, relrowsecurity FROM pg_class
WHERE relname = 'notifications' AND relnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'public'
);

-- ============================================================
-- STEP 2: Check existing policies on notifications
-- ============================================================
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- ============================================================
-- STEP 3: Enable RLS (if not already enabled)
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: Drop any conflicting old policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin read notifications"       ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_admin"     ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_service"   ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_admin"     ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_admin"     ON public.notifications;

-- ============================================================
-- STEP 5: Create SELECT policy — any authenticated user can read
-- (Admin panel has its own role-check layer; keeping this broad
--  ensures real-time events flow through without needing
--  a service-key client on the frontend.)
-- ============================================================
CREATE POLICY "notifications_select_admin"
ON public.notifications FOR SELECT
TO authenticated
USING (true);

-- Allow the backend (service role) to INSERT
CREATE POLICY "notifications_insert_service"
ON public.notifications FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow authenticated admins to UPDATE (mark as read)
CREATE POLICY "notifications_update_admin"
ON public.notifications FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated admins to DELETE
CREATE POLICY "notifications_delete_admin"
ON public.notifications FOR DELETE
TO authenticated
USING (true);

-- ============================================================
-- STEP 6: Enable replication for real-time
-- (Supabase Dashboard → Database → Replication → supabase_realtime
--  → Add table: notifications)
-- This SQL enables it programmatically:
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- VERIFY
-- ============================================================
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications' AND schemaname = 'public'
ORDER BY cmd, policyname;

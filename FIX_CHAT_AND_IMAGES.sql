-- ============================================================
-- FIX: Clear stale block records + Fix item images RLS
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- PART 1: Clear all stale blocked_users records
-- (removes leftover test blocks so chat works normally again)
-- ============================================================
DELETE FROM public.blocked_users;

-- PART 2: Fix item_images RLS — make images fully public for SELECT
-- Images live in a public storage bucket; restricting SELECT only hides thumbnails
-- from claimants and breaks "No image available" on claimed items.
-- The old policy only allowed active+unflagged items OR the finder → claimants could never see images.
-- ============================================================
DROP POLICY IF EXISTS "item_images_select_all" ON public.item_images;

CREATE POLICY "item_images_select_all"
    ON public.item_images FOR SELECT
    TO anon, authenticated
    USING (true);   -- images are in a public bucket; no row-level restriction needed

-- PART 3: Add blocked_users to realtime publication (for live block/unblock events)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'blocked_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;
  END IF;
END $$;

-- Ensure RLS is enabled on blocked_users
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Drop and recreate clean policies
DROP POLICY IF EXISTS "blocked_users_select" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_insert" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_delete" ON public.blocked_users;

CREATE POLICY "blocked_users_select"
ON public.blocked_users FOR SELECT
TO authenticated
USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

CREATE POLICY "blocked_users_insert"
ON public.blocked_users FOR INSERT
TO authenticated
WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "blocked_users_delete"
ON public.blocked_users FOR DELETE
TO authenticated
USING (blocker_id = auth.uid());

-- PART 4: Verify
-- ============================================================
SELECT 'blocked_users cleared'   AS check_name, COUNT(*) = 0   AS passes FROM public.blocked_users
UNION ALL
SELECT 'item_images policy fixed', COUNT(*) > 0 FROM pg_policies
  WHERE tablename = 'item_images' AND policyname = 'item_images_select_all'
UNION ALL
SELECT 'blocked_users in realtime', COUNT(*) > 0 FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'blocked_users';

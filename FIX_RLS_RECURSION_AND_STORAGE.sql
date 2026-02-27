-- ============================================================
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New query
-- Fixes:
--   1. "infinite recursion detected in policy for relation items"
--   2. Storage 500 on item-images upload
-- ============================================================

-- ============================================================
-- PART 1: FIX INFINITE RECURSION IN ITEMS RLS
-- ============================================================
-- The cause: items_select_claimant (added previously) queries claims,
-- but claims_select_own_item queries items → circular dependency.
-- Fix: drop that policy and just broaden items_select_public to
-- include 'claimed'/'returned' status (no subquery, no recursion).

-- Drop the bad recursive policy
DROP POLICY IF EXISTS "items_select_claimant" ON public.items;

-- Update public policy to allow active, claimed, returned
-- (simple status check = no subqueries = no recursion)
DROP POLICY IF EXISTS "items_select_public" ON public.items;
CREATE POLICY "items_select_public"
    ON public.items FOR SELECT
    TO anon, authenticated
    USING (
        status IN ('active', 'claimed', 'returned')
        AND is_flagged = false
    );

-- ============================================================
-- PART 2: FIX STORAGE POLICIES FOR item-images BUCKET
-- ============================================================

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'item-images',
    'item-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Drop and recreate storage policies cleanly
DROP POLICY IF EXISTS "item_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "item_images_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "item_images_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "item_images_delete_owner" ON storage.objects;

-- Public read
CREATE POLICY "item_images_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'item-images');

-- Authenticated upload to own folder ({user_id}/filename)
CREATE POLICY "item_images_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner update
CREATE POLICY "item_images_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner delete
CREATE POLICY "item_images_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- VERIFY
-- ============================================================
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'items'
ORDER BY policyname;

SELECT '✅ DONE! Recursion fixed, storage policies applied.' AS result;

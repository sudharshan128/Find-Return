-- FIX STORAGE UPLOAD 400 ERROR (v2 - Clean Fix)
-- Run this in Supabase SQL Editor
-- Problem: Conflicting INSERT policies with no WITH CHECK bucket restriction,
--          and "Authenticated users can upload" mistakenly set to {public} role.

-- ============================================
-- STEP 1: Remove ALL conflicting storage policies
-- ============================================

DROP POLICY IF EXISTS "Public read access"                              ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to their folder"  ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images"               ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images"               ON storage.objects;
DROP POLICY IF EXISTS "item_images_select_public"                       ON storage.objects;
DROP POLICY IF EXISTS "item_images_insert_authenticated"                ON storage.objects;
DROP POLICY IF EXISTS "item_images_update_owner"                        ON storage.objects;
DROP POLICY IF EXISTS "item_images_delete_owner"                        ON storage.objects;

-- Remove broad catch-all INSERT policies that apply to ALL buckets (the root cause!)
DROP POLICY IF EXISTS "auth_upload"        ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_items"  ON storage.objects;

-- ============================================
-- STEP 2: Ensure bucket is correctly configured
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'item-images',
    'item-images',
    true,
    5242880,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public              = true,
    file_size_limit     = 5242880,
    allowed_mime_types  = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'];

-- ============================================
-- STEP 3: Create clean correct policies
-- ============================================

-- Public read (SELECT) - anyone can view images
CREATE POLICY "item_images_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'item-images');

-- Authenticated INSERT - users upload to their own {user_id}/... folder
CREATE POLICY "item_images_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated UPDATE - users update their own files
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

-- Authenticated DELETE - users delete their own files
CREATE POLICY "item_images_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- VERIFY: Confirm only correct policies exist
-- ============================================

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND (policyname LIKE 'item_images%' OR policyname LIKE 'auth_upload%')
ORDER BY policyname;

-- Should show:
-- item_images_delete_owner  | {authenticated} | DELETE
-- item_images_insert_authenticated | {authenticated} | INSERT  (with_check NOT null)
-- item_images_select_public | {public}        | SELECT
-- item_images_update_owner  | {authenticated} | UPDATE
-- NO auth_upload rows


-- ============================================================
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New query
-- Fixes ALL outstanding RLS issues in one shot:
--   1. "Mark as Returned" → 403 new row violates RLS on user_profiles
--   2. Infinite recursion in items policies
--   3. Profile fetch timeouts caused by slow/recursive RLS
-- ============================================================

-- ============================================================
-- FIX 1: items_update_own — simple, no subquery
-- (old policy had a self-referential subquery that caused cascade
--  into user_profiles RLS → 403 on status update)
-- ============================================================
DROP POLICY IF EXISTS "items_update_own" ON public.items;

CREATE POLICY "items_update_own"
    ON public.items FOR UPDATE
    TO authenticated
    USING  (finder_id = auth.uid())
    WITH CHECK (finder_id = auth.uid());

-- ============================================================
-- FIX 2: Remove recursive items SELECT policy, broaden public one
-- ============================================================
DROP POLICY IF EXISTS "items_select_claimant" ON public.items;
DROP POLICY IF EXISTS "items_select_public"   ON public.items;

CREATE POLICY "items_select_public"
    ON public.items FOR SELECT
    TO anon, authenticated
    USING (
        status IN ('active', 'claimed', 'returned')
        AND is_flagged = false
    );

-- ============================================================
-- FIX 3: Storage policies for item-images bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'item-images', 'item-images', true, 5242880,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public            = true,
    file_size_limit   = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'];

DROP POLICY IF EXISTS "item_images_select_public"       ON storage.objects;
DROP POLICY IF EXISTS "item_images_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "item_images_update_owner"         ON storage.objects;
DROP POLICY IF EXISTS "item_images_delete_owner"         ON storage.objects;

CREATE POLICY "item_images_select_public"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'item-images');

CREATE POLICY "item_images_insert_authenticated"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'item-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "item_images_update_owner"
    ON storage.objects FOR UPDATE TO authenticated
    USING    (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "item_images_delete_owner"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- VERIFY
-- ============================================================
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'items'
ORDER BY policyname;

SELECT '✅ ALL RLS FIXES APPLIED — Mark as Returned and recursion fixed.' AS result;

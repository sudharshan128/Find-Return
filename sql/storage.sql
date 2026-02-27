-- ============================================
-- SUPABASE STORAGE BUCKET POLICIES
-- Lost & Found Bangalore
-- ============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('item-images', 'item-images', true),
    ('proof-images', 'proof-images', false),
    ('avatars', 'avatars', true);

-- ============================================
-- ITEM IMAGES BUCKET POLICIES
-- ============================================

-- Allow authenticated users to upload item images
CREATE POLICY "Users can upload item images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'item-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public to view item images
CREATE POLICY "Public can view item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own item images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'item-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own images
CREATE POLICY "Users can update own item images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'item-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- PROOF IMAGES BUCKET POLICIES (Private)
-- ============================================

-- Allow authenticated users to upload proof images
CREATE POLICY "Users can upload proof images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'proof-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Only claimant and item finder can view proof images
CREATE POLICY "Claimant and finder can view proof images"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'proof-images'
    AND auth.uid() IS NOT NULL
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM public.claims c
            JOIN public.items i ON i.id = c.item_id
            WHERE c.claimant_id::text = (storage.foldername(name))[1]
            AND i.finder_id = auth.uid()
        )
    )
);

-- Users can delete their own proof images
CREATE POLICY "Users can delete own proof images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'proof-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- AVATARS BUCKET POLICIES
-- ============================================

-- Allow authenticated users to upload avatars
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public to view avatars
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow users to update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- ADMIN POLICIES (Full access)
-- ============================================

-- Admins can access all objects
CREATE POLICY "Admins full access to storage"
ON storage.objects FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

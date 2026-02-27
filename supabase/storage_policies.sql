-- ============================================================
-- LOST & FOUND BANGALORE - STORAGE POLICIES
-- ============================================================
-- Version: 2.0.0
-- Date: 2026-01-06
-- Description: Supabase Storage bucket and access policies
-- 
-- IMPORTANT: Run this AFTER schema.sql
-- This script creates buckets and policies for file storage
-- ============================================================

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Create item-images bucket (main bucket for found item photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'item-images',
    'item-images',
    true, -- Public bucket for item images
    5242880, -- 5MB max file size
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create avatars bucket (for user profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true, -- Public bucket for avatars
    2097152, -- 2MB max file size
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create claim-evidence bucket (for proof of ownership photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'claim-evidence',
    'claim-evidence',
    false, -- Private bucket - only accessible to claim parties
    5242880, -- 5MB max file size
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create report-evidence bucket (for abuse report attachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'report-evidence',
    'report-evidence',
    false, -- Private bucket - only for moderators
    5242880, -- 5MB max file size
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- STORAGE POLICIES - ITEM IMAGES BUCKET
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "item_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "item_images_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "item_images_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "item_images_delete_owner" ON storage.objects;

-- Anyone can view item images (public bucket)
CREATE POLICY "item_images_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'item-images');

-- Authenticated users can upload to their own folder
-- Folder structure: item-images/{user_id}/{item_id}/{filename}
CREATE POLICY "item_images_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own images
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

-- Users can delete their own images
CREATE POLICY "item_images_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- STORAGE POLICIES - AVATARS BUCKET
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;

-- Anyone can view avatars (public bucket)
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Users can upload their own avatar
-- Folder structure: avatars/{user_id}/avatar.{ext}
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own avatar
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own avatar
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- STORAGE POLICIES - CLAIM EVIDENCE BUCKET
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "claim_evidence_select_parties" ON storage.objects;
DROP POLICY IF EXISTS "claim_evidence_insert_claimant" ON storage.objects;
DROP POLICY IF EXISTS "claim_evidence_delete_claimant" ON storage.objects;
DROP POLICY IF EXISTS "claim_evidence_moderator" ON storage.objects;

-- Only claim parties can view evidence
-- Folder structure: claim-evidence/{claim_id}/{filename}
CREATE POLICY "claim_evidence_select_parties"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'claim-evidence'
    AND EXISTS (
        SELECT 1 FROM public.claims c
        JOIN public.items i ON c.item_id = i.id
        WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.claimant_id = auth.uid() OR i.finder_id = auth.uid())
    )
);

-- Claimants can upload evidence for their claims
CREATE POLICY "claim_evidence_insert_claimant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'claim-evidence'
    AND EXISTS (
        SELECT 1 FROM public.claims
        WHERE id::text = (storage.foldername(name))[1]
        AND claimant_id = auth.uid()
        AND status = 'pending'
    )
);

-- Claimants can delete their own evidence
CREATE POLICY "claim_evidence_delete_claimant"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'claim-evidence'
    AND EXISTS (
        SELECT 1 FROM public.claims
        WHERE id::text = (storage.foldername(name))[1]
        AND claimant_id = auth.uid()
        AND status = 'pending'
    )
);

-- Moderators can access all claim evidence
CREATE POLICY "claim_evidence_moderator"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'claim-evidence'
    AND EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'moderator')
        AND account_status = 'active'
    )
)
WITH CHECK (
    bucket_id = 'claim-evidence'
    AND EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'moderator')
        AND account_status = 'active'
    )
);

-- ============================================================
-- STORAGE POLICIES - REPORT EVIDENCE BUCKET
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "report_evidence_insert_reporter" ON storage.objects;
DROP POLICY IF EXISTS "report_evidence_select_reporter" ON storage.objects;
DROP POLICY IF EXISTS "report_evidence_moderator" ON storage.objects;

-- Reporters can upload evidence with their reports
-- Folder structure: report-evidence/{report_id}/{filename}
CREATE POLICY "report_evidence_insert_reporter"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'report-evidence'
    AND EXISTS (
        SELECT 1 FROM public.abuse_reports
        WHERE id::text = (storage.foldername(name))[1]
        AND reporter_id = auth.uid()
        AND status = 'pending'
    )
);

-- Reporters can view their own report evidence
CREATE POLICY "report_evidence_select_reporter"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'report-evidence'
    AND EXISTS (
        SELECT 1 FROM public.abuse_reports
        WHERE id::text = (storage.foldername(name))[1]
        AND reporter_id = auth.uid()
    )
);

-- Moderators can access all report evidence
CREATE POLICY "report_evidence_moderator"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'report-evidence'
    AND EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'moderator')
        AND account_status = 'active'
    )
)
WITH CHECK (
    bucket_id = 'report-evidence'
    AND EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'moderator')
        AND account_status = 'active'
    )
);

-- ============================================================
-- STORAGE HELPER FUNCTIONS
-- ============================================================

-- Function to get public URL for an item image
CREATE OR REPLACE FUNCTION get_item_image_url(
    p_user_id UUID,
    p_item_id UUID,
    p_filename TEXT
)
RETURNS TEXT AS $$
BEGIN
    RETURN 'item-images/' || p_user_id::text || '/' || p_item_id::text || '/' || p_filename;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get avatar path
CREATE OR REPLACE FUNCTION get_avatar_path(p_user_id UUID, p_extension TEXT DEFAULT 'jpg')
RETURNS TEXT AS $$
BEGIN
    RETURN 'avatars/' || p_user_id::text || '/avatar.' || p_extension;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to clean up orphaned storage files
-- (Run this periodically via cron or admin action)
CREATE OR REPLACE FUNCTION cleanup_orphaned_storage()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- This is a placeholder - actual implementation would require
    -- listing storage files and comparing with database records
    -- Supabase doesn't have direct SQL access to storage.objects listing
    
    -- For now, just return 0
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORAGE LIMITS PER USER (Optional Rate Limiting)
-- ============================================================

-- Table to track user storage usage
CREATE TABLE IF NOT EXISTS public.user_storage_usage (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    total_bytes BIGINT DEFAULT 0 NOT NULL,
    file_count INTEGER DEFAULT 0 NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_storage_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "storage_usage_select_own" ON public.user_storage_usage;
DROP POLICY IF EXISTS "storage_usage_all" ON public.user_storage_usage;

-- Users can view their own usage
CREATE POLICY "storage_usage_select_own"
ON public.user_storage_usage FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- System can update usage (via triggers)
CREATE POLICY "storage_usage_all"
ON public.user_storage_usage FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Storage limits (adjustable per tier)
-- Free tier: 50MB total, 20 files
-- These would be checked in application code before upload
COMMENT ON TABLE public.user_storage_usage IS 'Tracks per-user storage consumption for quota enforcement';

-- ============================================================
-- DONE
-- ============================================================

SELECT 'Storage policies setup complete!' AS status;

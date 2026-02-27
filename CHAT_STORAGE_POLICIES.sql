-- ============================================================
-- STORAGE BUCKET POLICIES FOR CHAT ATTACHMENTS
-- ============================================================
-- Run this AFTER creating the 'chat-attachments' storage bucket
-- ============================================================

-- Policy 1: Chat participants can upload files to their chats
CREATE POLICY "Chat participants can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.chats
    WHERE finder_id = auth.uid() OR claimant_id = auth.uid()
  )
);

-- Policy 2: Chat participants can view files from their chats
CREATE POLICY "Chat participants can view"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.chats
    WHERE finder_id = auth.uid() OR claimant_id = auth.uid()
  )
);

-- Policy 3: Uploaders can delete their own files
CREATE POLICY "Uploader can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid() = owner
);

-- Verify policies
SELECT 
  policyname,
  tablename,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%chat%'
ORDER BY policyname;

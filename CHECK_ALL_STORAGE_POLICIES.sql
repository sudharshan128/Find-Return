-- CHECK ALL STORAGE POLICIES
-- Run in Supabase SQL Editor to see every policy on storage.objects

SELECT 
    policyname, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY cmd, policyname;

-- Also check if RLS is enabled on storage.objects
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'objects'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'storage');

-- Also confirm bucket config
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'item-images';

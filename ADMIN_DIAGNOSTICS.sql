-- ============================================================
-- ADMIN DIAGNOSTICS - Check Data Counts
-- ============================================================
-- Run this to verify data exists and RLS policies allow access
-- ============================================================

-- Check if items exist
SELECT 'Items' as table_name, COUNT(*) as count FROM public.items;

-- Check items by status
SELECT 
  'Items by status' as breakdown,
  status,
  COUNT(*) as count
FROM public.items
GROUP BY status;

-- Check users
SELECT 'Users' as table_name, COUNT(*) as count FROM public.user_profiles;

-- Check users by status
SELECT 
  'Users by status' as breakdown,
  account_status,
  COUNT(*) as count
FROM public.user_profiles
GROUP BY account_status;

-- Check claims
SELECT 'Claims' as table_name, COUNT(*) as count FROM public.claims;

-- Check claims by status
SELECT 
  'Claims by status' as breakdown,
  status,
  COUNT(*) as count
FROM public.claims
GROUP BY status;

-- Check abuse reports
SELECT 'Abuse Reports' as table_name, COUNT(*) as count FROM public.abuse_reports;

-- Check chats
SELECT 'Chats' as table_name, COUNT(*) as count FROM public.chats;

-- Check messages
SELECT 'Messages' as table_name, COUNT(*) as count FROM public.messages;

-- Check if RLS is enabled on items (should be true)
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('items', 'user_profiles', 'claims', 'abuse_reports')
ORDER BY tablename;

-- Check RLS policies on items table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'items'
ORDER BY policyname;

-- Check if your admin user exists and has correct permissions

-- 1. Check admin_users table
SELECT 
  id,
  email,
  role,
  is_active,
  created_at
FROM admin_users
WHERE email = 'sudharshancse123@gmail.com';

-- 2. If user doesn't exist, create it
-- Run this with your actual user_id from auth.users table:

INSERT INTO admin_users (user_id, email, full_name, role, is_active)
VALUES (
  'f0f76964-29de-4270-9d5a-acced20cff96',  -- Your auth.users id
  'sudharshancse123@gmail.com',
  'Super Admin',  -- Display name
  'super_admin', 
  true
)
ON CONFLICT (email) 
DO UPDATE SET
  user_id = 'f0f76964-29de-4270-9d5a-acced20cff96',
  full_name = 'Super Admin',
  role = 'super_admin',
  is_active = true;

-- 3. Check Supabase Auth users table
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'sudharshancse123@gmail.com';

-- 4. Verify RLS policies allow admin access
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'admin_users';

-- ============================================================
-- SIMPLE ADMIN FIX - Grant Admin to Your Account
-- ============================================================

-- Update the correct account (sudharshansbsg@gmail.com)
UPDATE public.user_profiles 
SET role = 'admin', account_status = 'active'
WHERE email = 'sudharshansbsg@gmail.com';

-- Verify the change
SELECT 
    email,
    full_name,
    role,
    account_status,
    created_at
FROM public.user_profiles
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- GRANT ADMIN ACCESS TO USER
-- ============================================================
-- This script promotes your Google account to admin role
-- ============================================================

-- Step 1: Find your user ID by email
-- Replace 'your-email@gmail.com' with your actual Google email
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'sudharshansbsg@gmail.com'; -- CHANGE THIS TO YOUR EMAIL
BEGIN
    -- Find user by email
    SELECT user_id INTO v_user_id
    FROM public.user_profiles
    WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found with email: %', v_email;
        RAISE NOTICE 'Available users:';
        FOR v_user_id IN 
            SELECT user_id FROM public.user_profiles
        LOOP
            RAISE NOTICE '  - User ID: %', v_user_id;
        END LOOP;
    ELSE
        -- Update user role to admin
        UPDATE public.user_profiles
        SET 
            role = 'admin',
            account_status = 'active'
        WHERE user_id = v_user_id;
        
        RAISE NOTICE '==========================================';
        RAISE NOTICE 'ADMIN ACCESS GRANTED!';
        RAISE NOTICE '==========================================';
        RAISE NOTICE 'User: %', v_email;
        RAISE NOTICE 'User ID: %', v_user_id;
        RAISE NOTICE 'Role: admin';
        RAISE NOTICE 'Status: active';
        RAISE NOTICE '==========================================';
        RAISE NOTICE 'You can now log in to the admin panel!';
        RAISE NOTICE '==========================================';
    END IF;
END $$;

-- Verify the change
SELECT 
    user_id,
    email,
    full_name,
    role,
    account_status,
    created_at
FROM public.user_profiles
WHERE email = 'sudharshansbsg@gmail.com'; -- CHANGE THIS TO YOUR EMAIL

-- ============================================================
-- FIX ADMIN AUDIT LOGS RLS POLICIES
-- ============================================================
-- Allow service role to insert audit logs
-- ============================================================

-- 1. Check current policies on admin_audit_logs
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'admin_audit_logs';

-- 2. Check if RLS is enabled
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'admin_audit_logs';

-- 3. Disable RLS on admin_audit_logs (service role should be able to insert)
ALTER TABLE public.admin_audit_logs DISABLE ROW LEVEL SECURITY;

-- OR if you want to keep RLS enabled, add service role bypass policy:
-- DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.admin_audit_logs;
-- CREATE POLICY "Service role can insert audit logs"
--     ON public.admin_audit_logs FOR INSERT
--     WITH CHECK (true);  -- Service role bypasses RLS anyway

-- 4. Allow admins to view audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.admin_audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );

-- 5a. First get your admin_users.id (NOT auth.users.id)
SELECT id, user_id, email FROM public.admin_users WHERE email = 'sudharshancse123@gmail.com';

-- 5b. Verify the fix - manually insert a test record using CORRECT admin_users.id
-- Replace the UUID below with the 'id' from the query above
INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    resource_type,
    resource_action,
    resource_id,
    ip_address,
    user_agent
)
SELECT 
    id,  -- Use admin_users.id, not user_id
    'TEST_INSERT',
    'test',
    'create',
    NULL,
    '127.0.0.1',
    'Manual Test'
FROM public.admin_users
WHERE email = 'sudharshancse123@gmail.com';

-- 6. Check if the insert worked
SELECT
    id,
    admin_id,
    action,
    resource_type,
    resource_action,
    created_at
FROM public.admin_audit_logs
ORDER BY created_at DESC
LIMIT 5;

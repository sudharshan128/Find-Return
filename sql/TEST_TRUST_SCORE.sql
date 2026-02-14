-- ============================================
-- Trust Score System - Quick Test Script
-- Run this after deployment to verify system
-- ============================================

-- Test 1: Verify all tables exist
SELECT 
    'trust_logs' as table_name,
    COUNT(*) as record_count
FROM public.trust_logs
UNION ALL
SELECT 'items', COUNT(*) FROM public.items
UNION ALL
SELECT 'claims', COUNT(*) FROM public.claims
UNION ALL
SELECT 'chat_sessions', COUNT(*) FROM public.chat_sessions
UNION ALL
SELECT 'abuse_reports', COUNT(*) FROM public.abuse_reports
UNION ALL
SELECT 'user_activity_tracking', COUNT(*) FROM public.user_activity_tracking;

-- Test 2: Verify users have trust columns
SELECT 
    id,
    name,
    trust_score,
    trust_level,
    email_verified,
    profile_completed,
    abuse_reports_count,
    last_trust_update
FROM public.users
LIMIT 5;

-- Test 3: Verify calculate_trust_level function
SELECT 
    calculate_trust_level(25) as risky_user,      -- Should return 'Risky User'
    calculate_trust_level(40) as fair_trust,      -- Should return 'Fair Trust'
    calculate_trust_level(60) as good_trust,      -- Should return 'Good Trust'
    calculate_trust_level(80) as high_trust,      -- Should return 'High Trust'
    calculate_trust_level(95) as verified_member; -- Should return 'Verified Trusted Member'

-- Test 4: Test manual trust score update
-- Replace 'YOUR-USER-ID' with actual user ID from your database
SELECT * FROM update_trust_score(
    'YOUR-USER-ID'::uuid,
    'test_action'::varchar,
    10,
    'Testing trust score system'::text,
    '{}'::jsonb,
    null
);

-- Test 5: Check trust logs created
SELECT 
    user_id,
    action_type,
    points_change,
    previous_score,
    new_score,
    previous_level,
    new_level,
    reason,
    created_at
FROM public.trust_logs
ORDER BY created_at DESC
LIMIT 10;

-- Test 6: Verify triggers exist
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name LIKE 'trigger_%'
ORDER BY trigger_name;

-- Test 7: Verify RLS policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('trust_logs', 'items', 'claims', 'chat_sessions', 'abuse_reports', 'user_activity_tracking')
ORDER BY tablename, policyname;

-- Test 8: Simulate email verification
-- Replace 'YOUR-USER-ID' with actual user ID
DO $$
DECLARE
    test_user_id UUID := 'YOUR-USER-ID'; -- Replace this
BEGIN
    -- Update email_verified to trigger trust score update
    UPDATE public.users 
    SET email_verified = true 
    WHERE id = test_user_id 
        AND (email_verified IS NULL OR email_verified = false);
    
    RAISE NOTICE 'Email verification trigger test complete. Check trust_logs for +5 points entry.';
END $$;

-- Test 9: Check the result
SELECT 
    tl.action_type,
    tl.points_change,
    tl.new_score,
    tl.reason,
    tl.created_at
FROM public.trust_logs tl
WHERE tl.user_id = 'YOUR-USER-ID' -- Replace this
    AND tl.action_type = 'email_verified'
ORDER BY tl.created_at DESC
LIMIT 1;

-- Test 10: Score distribution analysis
SELECT 
    trust_level,
    COUNT(*) as user_count,
    ROUND(AVG(trust_score), 2) as avg_score,
    MIN(trust_score) as min_score,
    MAX(trust_score) as max_score
FROM public.users
GROUP BY trust_level
ORDER BY min_score DESC;

-- Test 11: Recent trust activity
SELECT 
    u.name,
    tl.action_type,
    tl.points_change,
    tl.previous_score || ' → ' || tl.new_score as score_change,
    tl.previous_level || ' → ' || tl.new_level as level_change,
    tl.created_at
FROM public.trust_logs tl
JOIN public.users u ON u.id = tl.user_id
ORDER BY tl.created_at DESC
LIMIT 20;

-- Test 12: Verify idempotency protection
-- Run this twice and check that only one entry is created
SELECT * FROM update_trust_score(
    'YOUR-USER-ID'::uuid,
    'test_idempotency'::varchar,
    5,
    'Testing duplicate prevention'::text,
    '{}'::jsonb,
    null
);

-- Wait a moment and run again - should see "Duplicate action prevented" message
SELECT * FROM update_trust_score(
    'YOUR-USER-ID'::uuid,
    'test_idempotency'::varchar,
    5,
    'Testing duplicate prevention'::text,
    '{}'::jsonb,
    null
);

-- Test 13: Check for any users outside valid score range
SELECT 
    id,
    name,
    trust_score,
    'ERROR: Score out of range!' as issue
FROM public.users
WHERE trust_score < 0 OR trust_score > 100;
-- Should return 0 rows

-- ============================================
-- COMPLETION CHECK
-- ============================================
DO $$
DECLARE
    table_count INTEGER;
    trigger_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('trust_logs', 'items', 'claims', 'chat_sessions', 'abuse_reports', 'user_activity_tracking');
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
        AND trigger_name LIKE 'trigger_%';
    
    -- Count functions
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
        AND routine_name IN ('calculate_trust_level', 'update_trust_score', 'daily_trust_maintenance');
    
    -- Report results
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Trust Score System - Installation Check';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Tables Created: % of 6 expected', table_count;
    RAISE NOTICE 'Triggers Active: % (expected 8-10)', trigger_count;
    RAISE NOTICE 'Functions Created: % of 3 expected', function_count;
    RAISE NOTICE '============================================';
    
    IF table_count = 6 AND function_count = 3 THEN
        RAISE NOTICE '✅ System Status: OPERATIONAL';
    ELSE
        RAISE NOTICE '⚠️ System Status: INCOMPLETE - Check above counts';
    END IF;
    RAISE NOTICE '============================================';
END $$;

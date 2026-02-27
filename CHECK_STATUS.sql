-- Check 1: Is the trigger enabled?
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    tgenabled
FROM information_schema.triggers t
JOIN pg_trigger pt ON pt.tgname = t.trigger_name
WHERE trigger_name = 'on_claim_status_change';

-- Check 2: What's the current function code?
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_claim_approval';

-- Check 3: Check RLS policies on chats
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename = 'chats';

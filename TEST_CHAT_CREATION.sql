-- Test: Create a sample chat for testing
-- Run this in Supabase SQL Editor to create a test chat

-- First, let's check if you have any approved claims
SELECT 
    c.id as claim_id,
    i.id as item_id,
    i.title as item_title,
    i.finder_id,
    c.claimant_id,
    c.status
FROM claims c
JOIN items i ON c.item_id = i.id
WHERE c.status = 'approved'
LIMIT 5;

-- If you see results above, pick one and use it below
-- Replace these UUIDs with actual values from the query above:

-- INSERT INTO public.chats (
--     item_id,
--     claim_id,
--     finder_id,
--     claimant_id,
--     enabled
-- ) VALUES (
--     'YOUR_ITEM_ID',
--     'YOUR_CLAIM_ID', 
--     'YOUR_FINDER_ID',
--     'YOUR_CLAIMANT_ID',
--     true
-- )
-- ON CONFLICT (claim_id) DO NOTHING;

-- Then verify the chat was created:
SELECT 
    c.id,
    i.title as item_title,
    c.enabled,
    c.is_closed,
    c.is_frozen,
    c.created_at
FROM chats c
JOIN items i ON c.item_id = i.id
ORDER BY c.created_at DESC
LIMIT 5;

-- Enable realtime for chats and messages tables (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Verify realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('chats', 'messages');

-- ============================================================
-- FIX Schema Issues
-- ============================================================

-- Check 1: What columns does chats table have?
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chats' 
ORDER BY ordinal_position;

-- Check 2: What are the valid item_status enum values?
SELECT enumlabel 
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'item_status'
ORDER BY enumsortorder;

-- Check 3: What columns does messages table have?
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
ORDER BY ordinal_position;

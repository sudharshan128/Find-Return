# 🔒 Chat Security Enhancement - Option B Deployment Guide

## Overview
This guide walks you through deploying the Enhanced Security features (Option B) to your production database.

## What's Included
1. ✅ End-to-End Encryption (E2EE)
2. ✅ User Blocking System
3. ✅ Message Retention Policies
4. ✅ Secure Image Upload Validation
5. ✅ Spam Detection
6. ✅ Security Audit Logging

---

## Step 1: Deploy Database Changes

### Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard/project/yrdjpuvmijibfilrycnu
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"

### Run the Security Setup Script
Copy and paste the entire contents of `CHAT_SECURITY_ENHANCED_SETUP.sql` and execute it.

**What this creates:**
- `blocked_users` table
- `chat_attachments` table
- `message_retention_settings` table
- `chat_security_log` table
- 6 new RLS policies
- 3 database functions (block_user, unblock_user, is_user_blocked)
- 2 triggers (spam detection, message retention cleanup)
- Adds `is_encrypted` and `encryption_version` columns to messages

### Verify Installation
After running the script, you should see:
```
==========================================
SECURITY ENHANCEMENT SETUP COMPLETE!
==========================================
Tables created:
  - blocked_users: ✓
  - chat_attachments: ✓
  - message_retention_settings: ✓
  - chat_security_log: ✓
Security policies: X active
==========================================
```

---

## Step 2: Create Storage Bucket for Chat Attachments

### In Supabase Dashboard:
1. Click "Storage" in the left sidebar
2. Click "New bucket"
3. Name: `chat-attachments`
4. Set to **Private** (not public)
5. Click "Create bucket"

### Set Storage Policies:
Click on the `chat-attachments` bucket, then "Policies" tab:

**Policy 1: Upload**
```sql
CREATE POLICY "Chat participants can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.chats
    WHERE finder_id = auth.uid() OR claimant_id = auth.uid()
  )
);
```

**Policy 2: View**
```sql
CREATE POLICY "Chat participants can view"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.chats
    WHERE finder_id = auth.uid() OR claimant_id = auth.uid()
  )
);
```

**Policy 3: Delete**
```sql
CREATE POLICY "Uploader can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid() = owner
);
```

---

## Step 3: Frontend Files (Already Created)

The following files have been created and are ready to use:

### ✅ Created Files:
- `frontend/src/utils/encryption.js` - E2EE utilities
- `frontend/src/utils/imageUpload.js` - Secure image upload
- `frontend/src/components/BlockUserButton.jsx` - Block user UI
- `frontend/src/pages/BlockedUsersPage.jsx` - Manage blocked users
- `frontend/src/pages/ChatPageNew.jsx` - Updated with E2EE

### ✅ Updated Files:
- `frontend/src/App.jsx` - Added blocked users route

---

## Step 4: Test the Features

### Test E2EE:
1. Open browser console (F12)
2. Go to a chat
3. Look for: "Encryption initialized" in console
4. Send a message
5. Check database - message_text should be encrypted base64 string
6. Verify green "E2EE" badge shows in chat header

### Test User Blocking:
1. Open a chat
2. Click "Block User" button in header
3. Enter reason, confirm
4. Try sending message as blocked user (should fail)
5. Go to `/blocked-users` to manage blocks
6. Unblock user to restore messaging

### Test Message Retention:
```sql
-- Check retention settings
SELECT * FROM message_retention_settings;

-- Manually trigger cleanup (for testing)
SELECT cleanup_old_messages();
```

### Test Spam Detection:
1. Try sending 11+ messages rapidly in same chat
2. Should see: "Rate limit exceeded" error
3. Check security log:
```sql
SELECT * FROM chat_security_log WHERE event_type = 'spam_detected';
```

---

## Step 5: Configure Message Retention

### Set Global Retention Policy:
```sql
UPDATE message_retention_settings
SET retention_days = 90,  -- Keep for 90 days
    auto_delete_enabled = TRUE
WHERE category_id IS NULL;
```

### Set Per-Category Retention (Optional):
```sql
-- Example: Keep high-value item messages for 180 days
INSERT INTO message_retention_settings (category_id, retention_days, auto_delete_enabled)
VALUES (
  (SELECT id FROM categories WHERE name = 'Electronics'),
  180,
  TRUE
);
```

### Schedule Automatic Cleanup:
In Supabase Dashboard > Database > Extensions:
1. Enable `pg_cron` extension
2. Add scheduled job:
```sql
SELECT cron.schedule(
  'cleanup-old-messages',
  '0 2 * * *',  -- Daily at 2 AM
  'SELECT cleanup_old_messages();'
);
```

---

## Step 6: Monitor Security

### View Security Logs:
```sql
-- Recent security events
SELECT 
  event_type,
  user_id,
  chat_id,
  metadata,
  created_at
FROM chat_security_log
ORDER BY created_at DESC
LIMIT 50;

-- Spam attempts
SELECT 
  user_id,
  COUNT(*) as spam_attempts
FROM chat_security_log
WHERE event_type = 'spam_detected'
GROUP BY user_id
ORDER BY spam_attempts DESC;

-- Most blocked users
SELECT 
  blocked_id,
  COUNT(*) as times_blocked
FROM blocked_users
GROUP BY blocked_id
ORDER BY times_blocked DESC;
```

---

## Security Best Practices

### ✅ Do:
- Keep frontend dependencies updated (npm audit)
- Monitor security logs regularly
- Set appropriate retention periods
- Test E2EE in different browsers
- Educate users about blocking feature

### ❌ Don't:
- Store encryption keys on server
- Disable RLS policies
- Extend retention unnecessarily
- Ignore security log alerts
- Allow unencrypted sensitive data

---

## Troubleshooting

### E2EE Not Working:
- Check browser supports Web Crypto API (modern browsers only)
- Open console, look for encryption errors
- Verify `is_encrypted` column exists in messages table

### Blocking Not Working:
- Verify RLS policies are enabled
- Check `blocked_users` table for entries
- Test with different user accounts

### Images Not Uploading:
- Verify `chat-attachments` bucket exists
- Check storage policies are correct
- Confirm file size < 10MB

### Spam Detection Too Strict:
Adjust rate limit in `check_spam_rate_limit()` function:
```sql
-- Change from 10 to 20 messages per minute
max_messages INTEGER := 20;
```

---

## Rollback Instructions

If you need to revert changes:

```sql
-- Drop new tables
DROP TABLE IF EXISTS chat_security_log CASCADE;
DROP TABLE IF EXISTS chat_attachments CASCADE;
DROP TABLE IF EXISTS message_retention_settings CASCADE;
DROP TABLE IF EXISTS blocked_users CASCADE;

-- Remove columns
ALTER TABLE messages DROP COLUMN IF EXISTS is_encrypted;
ALTER TABLE messages DROP COLUMN IF EXISTS encryption_version;

-- Drop functions
DROP FUNCTION IF EXISTS block_user CASCADE;
DROP FUNCTION IF EXISTS unblock_user CASCADE;
DROP FUNCTION IF EXISTS is_user_blocked CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_messages CASCADE;
DROP FUNCTION IF EXISTS check_spam_rate_limit CASCADE;
```

---

## Support

If you encounter issues:
1. Check Supabase logs in dashboard
2. Review browser console for frontend errors
3. Verify all files were created correctly
4. Test with clean browser session

---

## Next Steps

After deployment:
1. ✅ Test all features thoroughly
2. ✅ Monitor security logs for first week
3. ✅ Adjust retention policies based on usage
4. ✅ Consider adding admin moderation tools (Option C)
5. ✅ Document user-facing features

---

**Deployment Status:**
- [ ] Database schema deployed
- [ ] Storage bucket created
- [ ] Storage policies set
- [ ] E2EE tested
- [ ] User blocking tested
- [ ] Message retention configured
- [ ] Spam detection verified
- [ ] Security logging active

Mark items as you complete them! 🚀

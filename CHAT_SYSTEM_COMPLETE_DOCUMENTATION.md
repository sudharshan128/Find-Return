# 🔐 Production-Ready Chat System - Complete Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Security Architecture](#security-architecture)
3. [Database Setup](#database-setup)
4. [Backend API](#backend-api)
5. [Frontend Components](#frontend-components)
6. [Deployment Guide](#deployment-guide)
7. [Testing & Verification](#testing--verification)
8. [Admin Controls](#admin-controls)

---

## Overview

A fully secure, real-time chat system for your Lost & Found application that enables communication only between item finders and approved claimants.

### ✨ Key Features

- **Strict Authorization**: Only approved claimant and item finder can chat
- **Real-time Updates**: Supabase Realtime for instant message delivery
- **Row Level Security**: Database-enforced access control
- **Rate Limiting**: Prevents message spam (50 messages/minute)
- **Admin Controls**: Freeze/unfreeze chats, delete messages
- **Audit Logging**: Track all administrative actions
- **Soft Deletes**: Messages can be deleted without losing history
- **Unread Counts**: Track unread messages per participant
- **Chat States**: Enabled, closed, frozen status management

---

## Security Architecture

### 1. **Authentication Layer**
```
User → JWT Token → Backend Middleware → Supabase Auth Verification
```

- Every API request requires valid JWT token
- Token validated on every request
- User account status checked (must be 'active')

### 2. **Authorization Layer**
```
Request → Check RLS Policies → Verify Participant → Allow/Deny
```

- Database RLS policies enforce row-level access
- Frontend and backend both verify authorization
- No direct database access without authentication

### 3. **Rate Limiting**
- 50 messages per minute per user
- Prevents spam and abuse
- In-memory tracking (use Redis in production)

### 4. **Data Validation**
- Message length: max 2000 characters
- XSS prevention: React auto-escapes
- SQL injection prevention: Parameterized queries

---

## Database Setup

### Step 1: Run SQL Setup Script

Execute `CHAT_SYSTEM_DATABASE_SETUP.sql`:

```bash
# In Supabase Dashboard → SQL Editor
# Or using psql
psql -h YOUR_DB_HOST -U postgres -d YOUR_DB -f CHAT_SYSTEM_DATABASE_SETUP.sql
```

### Step 2: Verify Schema

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('chats', 'messages');

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('chats', 'messages');

-- Check triggers
SELECT tgname FROM pg_trigger 
WHERE tgname LIKE '%message%';
```

### Key Database Features

#### **chats table**
- `id`: UUID primary key
- `item_id`, `claim_id`: Links to item and approved claim
- `finder_id`, `claimant_id`: Participant user IDs
- `enabled`: Chat can be disabled
- `is_closed`: Chat marked as closed (item returned)
- `is_frozen`: Admin emergency freeze
- `frozen_by`, `frozen_at`, `freeze_reason`: Audit trail
- `finder_unread_count`, `claimant_unread_count`: Separate counters
- `last_message_at`: For sorting

#### **messages table**
- `id`: UUID primary key
- `chat_id`: Foreign key to chats
- `sender_id`: User who sent message
- `message_text`: Message content (max 2000 chars)
- `is_read`: Read status
- `is_deleted`: Soft delete flag
- `created_at`: Timestamp

#### **RLS Policies**

**chats table:**
1. `chats_select_participant` - Participants can view their chats
2. `chats_insert_on_approval` - Only on approved claims
3. `chats_update_participant` - Participants can update
4. `chats_admin_all` - Admins have full access

**messages table:**
1. `messages_select_participant` - View messages in your chats
2. `messages_insert_participant` - Send if chat active/not frozen
3. `messages_update_own` - Mark own messages as read
4. `messages_delete_own` - Soft delete own messages
5. `messages_admin_all` - Admins have full access

---

## Backend API

### Setup

1. **Install Dependencies**
```bash
cd backend
npm install @supabase/supabase-js
```

2. **Environment Variables**
```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

3. **Register Routes**
```typescript
// backend/src/index.ts
import chatRoutes from './routes/chatRoutes';

app.use('/api/chats', chatRoutes);
```

### API Endpoints

#### **GET /api/chats**
Get all chats for authenticated user.

**Response:**
```json
{
  "chats": [
    {
      "id": "uuid",
      "item": { "id": "uuid", "title": "iPhone 13" },
      "otherParticipant": {
        "user_id": "uuid",
        "full_name": "John Doe",
        "avatar_url": "https://..."
      },
      "unreadCount": 3,
      "last_message_at": "2024-01-15T10:30:00Z",
      "is_frozen": false
    }
  ]
}
```

#### **GET /api/chats/:chatId**
Get single chat with messages.

**Query Params:**
- `limit` (default: 50): Number of messages
- `before` (optional): Timestamp for pagination

**Response:**
```json
{
  "chat": { /* chat object */ },
  "messages": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "message_text": "Hello!",
      "created_at": "2024-01-15T10:30:00Z",
      "is_read": false,
      "sender": {
        "user_id": "uuid",
        "full_name": "John Doe",
        "avatar_url": "https://..."
      }
    }
  ]
}
```

#### **POST /api/chats/:chatId/messages**
Send a message.

**Request Body:**
```json
{
  "message_text": "Hello, is the item still available?"
}
```

**Validation:**
- Message text required
- Max 2000 characters
- Rate limit: 50 messages/minute
- Chat must be enabled, not closed, not frozen

**Response:**
```json
{
  "message": { /* message object with sender info */ }
}
```

#### **PUT /api/chats/:chatId/read**
Mark all messages as read.

**Response:**
```json
{
  "success": true
}
```

#### **PUT /api/chats/:chatId/freeze** (Admin Only)
Freeze a chat.

**Request Body:**
```json
{
  "reason": "Inappropriate content reported"
}
```

**Response:**
```json
{
  "chat": { /* updated chat with is_frozen: true */ }
}
```

#### **PUT /api/chats/:chatId/unfreeze** (Admin Only)
Unfreeze a chat.

#### **DELETE /api/chats/:chatId/messages/:messageId** (Admin Only)
Soft delete a message.

---

## Frontend Components

### Setup

1. **Update Routes**
```jsx
// frontend/src/App.jsx
import ChatPageNew from './pages/ChatPageNew';
import ChatsListPage from './pages/ChatsListPage';

// Add routes
<Route path="/chats" element={<ChatsListPage />} />
<Route path="/chats/:id" element={<ChatPageNew />} />
```

2. **Install Dependencies** (if not already)
```bash
npm install lucide-react date-fns react-hot-toast
```

### Components

#### **ChatPageNew.jsx**
Full-featured chat page with:
- Real-time message updates
- Read receipts
- Status indicators (frozen/closed)
- Message input with character count
- Auto-scroll to latest message
- Error handling

#### **ChatsListPage.jsx**
List of all user's chats:
- Search functionality
- Unread counts badge
- Last message timestamp
- Status badges (frozen/closed)
- Real-time updates

#### **AdminChatControls.jsx**
Admin moderation tools:
- Freeze/unfreeze chats
- Reason input for freezing
- Audit logging
- Confirmation dialogs

### Usage Example

```jsx
// In your claim approval flow
const handleApprove = async (claimId) => {
  // 1. Approve the claim
  await updateClaimStatus(claimId, 'approved');
  
  // 2. Create or get chat (automatically via trigger or manually)
  const { data: chat } = await supabase
    .from('chats')
    .select('id')
    .eq('claim_id', claimId)
    .single();
  
  // 3. Navigate to chat
  navigate(`/chats/${chat.id}`);
  
  // 4. Send welcome message (optional)
  await supabase.from('messages').insert({
    chat_id: chat.id,
    sender_id: user.id,
    message_text: 'Hello! Let\'s arrange the item return.'
  });
};
```

---

## Deployment Guide

### 1. Database Migration

```bash
# Connect to production database
psql $DATABASE_URL -f CHAT_SYSTEM_DATABASE_SETUP.sql

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('chats', 'messages');"
```

### 2. Backend Deployment

```bash
# Build
cd backend
npm run build

# Deploy (example with PM2)
pm2 start dist/index.js --name "lostandfound-api"

# Or Docker
docker build -t lostandfound-backend .
docker run -p 3000:3000 lostandfound-backend
```

### 3. Frontend Deployment

```bash
# Build
cd frontend
npm run build

# Deploy to hosting (Vercel/Netlify/etc)
vercel deploy --prod
```

### 4. Environment Variables

**Backend (.env):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
PORT=3000
NODE_ENV=production
```

**Frontend (.env):**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=https://api.yourapp.com
```

---

## Testing & Verification

### 1. Database Tests

```sql
-- Test RLS policies as regular user
SET ROLE authenticated;
SET request.jwt.claims.sub = 'test-user-id';

-- Should return only user's chats
SELECT * FROM chats;

-- Should allow insert to own chat
INSERT INTO messages (chat_id, sender_id, message_text) 
VALUES ('chat-id', 'test-user-id', 'Test message');

-- Should deny insert to frozen chat
-- (First freeze a chat, then try to insert)
```

### 2. API Tests

```bash
# Get auth token
TOKEN="your_jwt_token"

# Test get chats
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/chats

# Test send message
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message_text":"Test message"}' \
  http://localhost:3000/api/chats/CHAT_ID/messages

# Test rate limiting (send 51 messages rapidly)
for i in {1..51}; do
  curl -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message_text\":\"Message $i\"}" \
    http://localhost:3000/api/chats/CHAT_ID/messages
done
```

### 3. Frontend Tests

Manual testing checklist:
- [ ] Login as finder, approve a claim
- [ ] Chat automatically created
- [ ] Send message as finder
- [ ] Login as claimant
- [ ] See message, send reply
- [ ] Verify real-time updates
- [ ] Try sending 2000+ character message (should fail)
- [ ] Admin freezes chat
- [ ] Verify neither user can send messages
- [ ] Admin unfreezes chat
- [ ] Verify messages work again

---

## Admin Controls

### Freezing a Chat

Admins can freeze chats when:
- Inappropriate content reported
- Suspected fraud
- Terms of service violation

**How to freeze:**
1. Admin navigates to chat
2. Sees "Admin Controls" panel
3. Clicks "Freeze Chat"
4. Enters reason
5. Confirms

**Effect:**
- No new messages can be sent
- Existing messages remain visible
- Red "Frozen" badge displayed
- Participants see freeze reason

### Unfreezing a Chat

**How to unfreeze:**
1. Admin navigates to frozen chat
2. Sees freeze reason
3. Clicks "Unfreeze Chat"
4. Confirms

### Deleting Messages (Soft Delete)

```typescript
// Admin can soft-delete any message
await supabase
  .from('messages')
  .update({ is_deleted: true })
  .eq('id', messageId);
```

Soft-deleted messages:
- Not shown in chat UI
- Preserved in database for audit
- Can be restored by database admin if needed

---

## Security Best Practices

### ✅ Implemented

1. **JWT Authentication** - All requests verified
2. **RLS Policies** - Database-enforced authorization
3. **Rate Limiting** - Prevents spam
4. **Input Validation** - Length and content checks
5. **Audit Logging** - All admin actions logged
6. **Soft Deletes** - Messages preserved for investigations
7. **Parameterized Queries** - SQL injection prevention
8. **XSS Prevention** - React auto-escapes content

### 🔄 Recommended Enhancements

1. **Redis for Rate Limiting** - Replace in-memory map
2. **Message Encryption** - End-to-end encryption
3. **File Attachments** - Image sharing with virus scanning
4. **Content Moderation** - AI-based content filtering
5. **WebSocket Alternative** - Socket.io for more control
6. **Typing Indicators** - Real-time typing status
7. **Read Receipts** - Show when message was read
8. **Message Reactions** - Like/thumbs up
9. **Block User** - Allow users to block each other
10. **Export Chat** - Download chat history

---

## Troubleshooting

### Messages Not Appearing

**Check:**
1. RLS policies enabled: `SELECT * FROM pg_policies WHERE tablename='messages';`
2. User is participant: Query `chats` table
3. Message not deleted: Check `is_deleted` flag
4. Real-time subscription active: Check browser console

### Can't Send Messages

**Check:**
1. Chat enabled: `chat.enabled = true`
2. Chat not closed: `chat.is_closed = false`
3. Chat not frozen: `chat.is_frozen = false`
4. User is participant: `finder_id` or `claimant_id`
5. Rate limit not exceeded: Wait 1 minute

### Real-time Not Working

**Check:**
1. Supabase Realtime enabled in dashboard
2. Table replication enabled for `messages` and `chats`
3. Network connection stable
4. Browser console for errors

### RLS Policy Errors

**Common issues:**
- Infinite recursion: Avoid self-referencing policies
- Multiple row returns: Use `LIMIT 1` in subqueries
- Performance: Add indexes on filtered columns

---

## Support & Maintenance

### Monitoring

**Key Metrics:**
- Messages per day
- Average response time
- Chat creation rate
- Frozen chats count
- Failed message sends

**Queries:**
```sql
-- Messages today
SELECT COUNT(*) FROM messages 
WHERE created_at >= CURRENT_DATE;

-- Active chats
SELECT COUNT(*) FROM chats 
WHERE is_closed = false AND enabled = true;

-- Frozen chats needing review
SELECT COUNT(*) FROM chats 
WHERE is_frozen = true;
```

### Backup

```bash
# Backup chats and messages
pg_dump -h YOUR_HOST -U postgres -d YOUR_DB \
  -t chats -t messages \
  > chat_backup_$(date +%Y%m%d).sql
```

---

## Conclusion

You now have a **production-ready, secure chat system** with:
- ✅ Strict authentication and authorization
- ✅ Real-time messaging
- ✅ Admin controls
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Comprehensive error handling

**Next Steps:**
1. Run database setup script
2. Deploy backend API
3. Update frontend routes
4. Test thoroughly
5. Monitor and iterate

🎉 **Your chat system is ready for production!**

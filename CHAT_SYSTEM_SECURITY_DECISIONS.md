# 🔐 Chat System Security Architecture & Design Decisions

## Executive Summary

This document explains every security decision made in the chat system implementation, providing rationale and trade-offs for each choice.

---

## 1. Authentication Strategy

### Decision: JWT-Based Authentication via Supabase Auth

**Why:**
- Industry standard for stateless authentication
- Native Supabase integration
- Automatic token refresh
- Built-in user management

**How it works:**
```
User logs in → Supabase Auth issues JWT → Frontend stores JWT →
Every request includes JWT → Backend validates JWT → RLS policies enforce access
```

**Security benefits:**
- ✅ No session storage on backend (stateless)
- ✅ Token expiry enforced (default 1 hour)
- ✅ Automatic refresh handling
- ✅ Cannot be forged without secret key

**Alternatives considered:**
- ❌ Session-based auth: Requires server-side storage, harder to scale
- ❌ API keys: Less secure, no expiration
- ❌ Basic auth: Not secure for web applications

---

## 2. Row Level Security (RLS) Policies

### Decision: Database-Enforced Authorization

**Why:**
- Defense in depth: Even if backend is compromised, database remains secure
- Centralized security logic
- Automatic enforcement on all queries
- No way to bypass (unlike middleware)

**Implementation:**

**For chats table:**
```sql
-- Participants can only see their own chats
CREATE POLICY "chats_select_participant"
    ON public.chats FOR SELECT
    USING (finder_id = auth.uid() OR claimant_id = auth.uid());
```

**For messages table:**
```sql
-- Only participants can see messages
CREATE POLICY "messages_select_participant"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
        )
    );
```

**Security benefits:**
- ✅ Cannot read other users' chats/messages
- ✅ Cannot send messages to chats you're not in
- ✅ Cannot modify other users' data
- ✅ Works even with direct SQL access

**Trade-offs:**
- ⚠️ Slightly more complex queries
- ⚠️ Need to understand PostgreSQL RLS
- ⚠️ Performance overhead (mitigated with indexes)

**Alternatives considered:**
- ❌ Backend-only authorization: Can be bypassed if backend compromised
- ❌ No authorization: Obviously insecure
- ❌ Application-level checks only: Not enforced at database level

---

## 3. Message Insertion Constraints

### Decision: Multi-Layer Validation

**Layer 1: Frontend validation**
```jsx
if (text.length > 2000) {
  toast.error('Message too long');
  return;
}
```

**Layer 2: RLS policy check**
```sql
WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.chats
        WHERE chats.id = messages.chat_id
        AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
        AND chats.enabled = TRUE
        AND chats.is_closed = FALSE
        AND chats.is_frozen = FALSE
    )
)
```

**Layer 3: Backend validation**
```typescript
if (!message_text || message_text.trim().length === 0) {
  return res.status(400).json({ error: 'Message text is required' });
}

if (message_text.length > 2000) {
  return res.status(400).json({ error: 'Message too long' });
}
```

**Why multiple layers:**
- Frontend: Fast feedback, good UX
- Backend: Can't be bypassed with browser tools
- Database: Ultimate enforcement, even if backend fails

**Security benefits:**
- ✅ Cannot send to frozen/closed chats
- ✅ Cannot send messages as another user
- ✅ Cannot send to chats you're not in
- ✅ Message length enforced

---

## 4. Rate Limiting

### Decision: Per-User Rate Limiting (50 messages/minute)

**Implementation:**
```typescript
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + 60000, // 1 minute window
    });
    return true;
  }

  if (userLimit.count >= 50) {
    return false; // Rate limit exceeded
  }

  userLimit.count++;
  return true;
}
```

**Why 50 messages/minute:**
- Normal conversation: ~1 message every few seconds = ~10-20/min
- 50 allows burst messaging without blocking legitimate use
- Prevents spam attacks (thousands of messages)

**Security benefits:**
- ✅ Prevents message spam
- ✅ Protects against DoS attacks
- ✅ Reduces database load
- ✅ Maintains service quality

**Trade-offs:**
- ⚠️ In-memory storage (lost on restart)
- ⚠️ Not distributed (doesn't work with multiple servers)

**Production recommendation:**
```typescript
// Use Redis for distributed rate limiting
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `rate_limit:${userId}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, 60); // 1 minute
  }
  
  return current <= 50;
}
```

**Alternatives considered:**
- ❌ No rate limiting: Open to spam/DoS
- ❌ Global rate limit: One user affects everyone
- ❌ IP-based: Doesn't work with proxies/VPNs

---

## 5. Admin Freeze Mechanism

### Decision: Separate Freeze Status with Audit Trail

**Schema:**
```sql
ALTER TABLE public.chats ADD COLUMN is_frozen BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chats ADD COLUMN frozen_at TIMESTAMPTZ;
ALTER TABLE public.chats ADD COLUMN frozen_by UUID REFERENCES user_profiles(user_id);
ALTER TABLE public.chats ADD COLUMN freeze_reason TEXT;
```

**Why separate from `enabled` and `is_closed`:**
- `enabled`: System-level disable (technical issues)
- `is_closed`: Item returned, chat naturally concluded
- `is_frozen`: Admin intervention (abuse/fraud)

**Security benefits:**
- ✅ Clear audit trail (who, when, why)
- ✅ Reversible action
- ✅ Different UI treatment
- ✅ Can analyze freeze patterns

**Enforcement:**
```sql
-- In RLS policy
AND chats.is_frozen = FALSE
```

```typescript
// In backend
if (chat.is_frozen) {
  return res.status(403).json({ 
    error: 'Chat is frozen by an administrator' 
  });
}
```

**Admin authorization:**
```typescript
function requireAdmin(req, res, next) {
  if (!req.profile || !['admin', 'moderator'].includes(req.profile.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
```

**Alternatives considered:**
- ❌ Just use `enabled = false`: Loses context (why disabled?)
- ❌ Delete chat: Loses evidence for investigations
- ❌ No freeze mechanism: Can't stop abuse quickly

---

## 6. Soft Delete for Messages

### Decision: Mark Deleted, Don't Actually Delete

**Implementation:**
```sql
ALTER TABLE public.messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- Query excludes deleted messages
SELECT * FROM messages 
WHERE chat_id = $1 
AND is_deleted = false;
```

**Why soft delete:**
- Evidence preservation for investigations
- Ability to restore if deleted by mistake
- Audit trail compliance
- User privacy while maintaining safety

**Security benefits:**
- ✅ Can investigate abuse after message deleted
- ✅ Can restore accidentally deleted messages
- ✅ Compliant with data retention policies
- ✅ User sees message as deleted immediately

**Privacy consideration:**
- Deleted messages stored in database
- Only admins with direct database access can see
- Can be hard-deleted after retention period

**Future enhancement:**
```sql
-- Auto-delete after retention period
CREATE OR REPLACE FUNCTION hard_delete_old_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM messages 
    WHERE is_deleted = true 
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron
SELECT cron.schedule('hard-delete-messages', '0 0 * * *', 'SELECT hard_delete_old_messages()');
```

**Alternatives considered:**
- ❌ Hard delete immediately: Loses evidence
- ❌ Never delete: Privacy concerns, bloated database
- ❌ Archive to separate table: More complex

---

## 7. Unread Count Management

### Decision: Per-Participant Counter in Chat Record

**Schema:**
```sql
ALTER TABLE public.chats ADD COLUMN finder_unread_count INTEGER DEFAULT 0;
ALTER TABLE public.chats ADD COLUMN claimant_unread_count INTEGER DEFAULT 0;
```

**Why separate counters:**
- Each participant has their own unread count
- Efficient: No need to count messages on every query
- Real-time updates via triggers

**Trigger implementation:**
```sql
CREATE OR REPLACE FUNCTION update_chat_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chats
    SET 
        -- Increment unread count for recipient only
        finder_unread_count = CASE 
            WHEN NEW.sender_id != finder_id THEN finder_unread_count + 1
            ELSE finder_unread_count
        END,
        claimant_unread_count = CASE 
            WHEN NEW.sender_id != claimant_id THEN claimant_unread_count + 1
            ELSE claimant_unread_count
        END
    WHERE id = NEW.chat_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Reset on read:**
```sql
-- When user opens chat
UPDATE chats 
SET finder_unread_count = 0 
WHERE id = $1 AND finder_id = $2;
```

**Security benefits:**
- ✅ Cannot see other user's unread status
- ✅ Cannot manipulate other's unread count
- ✅ Accurate count without querying messages

**Alternatives considered:**
- ❌ Count messages on every request: Slow, inefficient
- ❌ Single unread count: Can't track per-user
- ❌ Frontend-only tracking: Lost on refresh

---

## 8. Chat Creation Authorization

### Decision: Only on Approved Claims

**RLS Policy:**
```sql
CREATE POLICY "chats_insert_on_approval"
    ON public.chats FOR INSERT
    WITH CHECK (
        (finder_id = auth.uid() OR claimant_id = auth.uid())
        AND
        EXISTS (
            SELECT 1 FROM public.claims
            WHERE claims.id = chats.claim_id
            AND claims.status = 'approved'
        )
    );
```

**Why:**
- Prevents random users from creating chats
- Ensures legitimate claims only
- Enforces business logic at database level

**Security benefits:**
- ✅ Cannot create chat without approved claim
- ✅ Cannot create chat with strangers
- ✅ Must be participant (finder or claimant)
- ✅ One chat per claim (UNIQUE constraint)

**Unique constraint:**
```sql
ALTER TABLE public.chats 
ADD CONSTRAINT chats_claim_id_unique 
UNIQUE (claim_id);
```

Prevents:
- Multiple chats for same claim
- Duplicate chat creation
- Race conditions

**Alternatives considered:**
- ❌ Allow any user to chat: Security risk, spam
- ❌ Admin must approve chats: Too slow, poor UX
- ❌ No claim requirement: Can't verify legitimacy

---

## 9. Real-Time Security

### Decision: Supabase Realtime with RLS

**How it works:**
```typescript
const subscription = supabase
  .channel(`chat:${chatId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`,
    },
    handleNewMessage
  )
  .subscribe();
```

**Security enforcement:**
- Real-time respects RLS policies
- User only receives updates for their chats
- Cannot subscribe to other users' chats

**How Supabase enforces:**
1. WebSocket connection authenticated with JWT
2. Subscription filter checked against RLS policies
3. Only matching rows sent to client
4. Changes to other users' data not transmitted

**Security benefits:**
- ✅ Cannot spy on other chats
- ✅ Cannot receive unauthorized updates
- ✅ RLS policies apply to real-time
- ✅ No way to bypass via WebSocket

**Verification:**
```sql
-- Enable realtime for table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'messages';
```

**Alternatives considered:**
- ❌ Polling: Inefficient, delayed updates
- ❌ WebSocket without auth: Insecure
- ❌ Server-Sent Events: One-directional only

---

## 10. Input Sanitization

### Decision: Multi-Layer Sanitization

**Layer 1: React auto-escaping**
```jsx
// React automatically escapes
<p>{message.message_text}</p>

// Becomes:
<p>Hello &lt;script&gt;alert('xss')&lt;/script&gt;</p>
```

**Layer 2: Parameterized queries**
```typescript
// Never do this:
const query = `INSERT INTO messages (message_text) VALUES ('${text}')`;

// Always do this:
await supabase
  .from('messages')
  .insert({ message_text: text }); // Parameterized, safe
```

**Layer 3: Content validation**
```typescript
// Strip dangerous patterns
const sanitized = message_text
  .trim()
  .replace(/[<>]/g, ''); // Remove < and >

// Limit length
if (sanitized.length > 2000) {
  throw new Error('Too long');
}
```

**Security benefits:**
- ✅ XSS prevention
- ✅ SQL injection prevention
- ✅ No script execution
- ✅ Safe HTML rendering

**What's NOT done (intentionally):**
- ❌ HTML allowed in messages: Security risk
- ❌ Markdown rendering: Can be exploited
- ❌ Image embeds: Need separate security

**Future enhancement:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

// Allow safe HTML/Markdown
const clean = DOMPurify.sanitize(marked(message_text), {
  ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href']
});
```

**Alternatives considered:**
- ❌ No sanitization: XSS vulnerable
- ❌ Server-side rendering only: Slower
- ❌ Allow all HTML: Too risky

---

## 11. Audit Logging

### Decision: Log All Admin Actions

**Implementation:**
```typescript
// After freezing chat
await supabase.from('audit_logs').insert({
  user_id: user.id,
  action: 'chat_frozen',
  resource_type: 'chat',
  resource_id: chatId,
  details: { reason: freezeReason },
  created_at: new Date().toISOString()
});
```

**What's logged:**
- Chat frozen/unfrozen
- Messages deleted by admin
- Admin viewing chats
- Rate limit violations (future)

**Audit log schema:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(user_id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

**Security benefits:**
- ✅ Accountability (who did what, when)
- ✅ Investigation support
- ✅ Detect abuse of admin powers
- ✅ Compliance (GDPR, SOC2, etc.)

**Query examples:**
```sql
-- All actions by admin
SELECT * FROM audit_logs 
WHERE user_id = 'admin-id' 
ORDER BY created_at DESC;

-- All actions on a chat
SELECT * FROM audit_logs 
WHERE resource_type = 'chat' 
AND resource_id = 'chat-id';

-- Suspicious activity (many freezes)
SELECT user_id, COUNT(*) 
FROM audit_logs 
WHERE action = 'chat_frozen' 
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id 
HAVING COUNT(*) > 10;
```

**Alternatives considered:**
- ❌ No logging: Can't investigate issues
- ❌ Log everything: Too much data, privacy concerns
- ❌ Separate logging service: More complex

---

## 12. Error Handling & Information Disclosure

### Decision: Generic Error Messages to Users

**Bad (information disclosure):**
```typescript
catch (error) {
  res.status(500).json({ error: error.message });
  // Might leak: "User 'xxx' not found in table 'secret_table'"
}
```

**Good (generic):**
```typescript
catch (error) {
  console.error('Error sending message:', error); // Log details server-side
  res.status(500).json({ error: 'Failed to send message' }); // Generic to user
}
```

**Why:**
- Prevents leaking database structure
- Prevents leaking internal logic
- Prevents enumeration attacks

**Exception: User errors**
```typescript
// OK to be specific for user input errors
if (!message_text) {
  return res.status(400).json({ 
    error: 'Message text is required' 
  });
}
```

**Security benefits:**
- ✅ No database structure leaked
- ✅ No stack traces exposed
- ✅ No user enumeration
- ✅ Helpful for legitimate errors

**Alternatives considered:**
- ❌ Detailed errors to users: Security risk
- ❌ No error messages: Poor UX
- ❌ Same error for everything: Hard to debug

---

## Summary of Security Decisions

| # | Decision | Rationale | Trade-off |
|---|----------|-----------|-----------|
| 1 | JWT Auth | Industry standard, stateless | Token storage in frontend |
| 2 | RLS Policies | Database-enforced security | Query complexity |
| 3 | Multi-layer validation | Defense in depth | More code |
| 4 | Rate limiting | Prevent spam/DoS | Memory usage |
| 5 | Freeze mechanism | Quick response to abuse | Extra columns |
| 6 | Soft delete | Evidence preservation | Storage |
| 7 | Unread counters | Performance | Denormalization |
| 8 | Approved claims only | Ensure legitimacy | Can't chat before approval |
| 9 | Realtime with RLS | Secure real-time | Supabase dependency |
| 10 | Input sanitization | XSS/SQL injection prevention | No rich formatting |
| 11 | Audit logging | Accountability | Storage overhead |
| 12 | Generic errors | No information disclosure | Harder debugging |

---

## Security Best Practices Summary

✅ **Implemented:**
1. JWT authentication on all requests
2. RLS policies on all tables
3. Input validation (frontend + backend + database)
4. Rate limiting (50 msg/min)
5. Audit logging (admin actions)
6. Soft deletes (evidence preservation)
7. Generic error messages
8. Parameterized queries (SQL injection prevention)
9. React auto-escaping (XSS prevention)
10. Authorization checks (multiple layers)

🔄 **Recommended Next:**
1. Redis for distributed rate limiting
2. Content moderation AI
3. End-to-end encryption
4. Anomaly detection (suspicious patterns)
5. Two-factor authentication for admin actions
6. File upload scanning (if implementing attachments)
7. CAPTCHA for repeated violations
8. IP reputation checking

---

## Compliance Considerations

### GDPR
- ✅ User can delete their messages (soft delete)
- ✅ Audit logs for data access
- ⚠️ Need "export my data" feature
- ⚠️ Need "hard delete after 90 days" cron job

### SOC 2
- ✅ Audit logging
- ✅ Access controls (RLS)
- ✅ Encryption in transit (HTTPS)
- ⚠️ Need encryption at rest (Supabase default)

### COPPA (if under-13 users)
- ⚠️ Need parental consent
- ⚠️ Need age verification
- ⚠️ Additional privacy protections

---

## Threat Model

| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Unauthorized message reading | RLS policies | Low - enforced at DB level |
| Message spam | Rate limiting | Medium - can switch accounts |
| XSS attacks | React escaping | Low - no HTML allowed |
| SQL injection | Parameterized queries | Very Low - ORM protection |
| Admin abuse | Audit logging | Medium - trust admins |
| Account takeover | JWT expiry | Medium - need 2FA |
| DoS attacks | Rate limiting | Medium - need infrastructure protection |
| Data breach | RLS + encryption | Low - multi-layer defense |

---

## Conclusion

This chat system implements **defense in depth** with:
- **Multiple layers** of security
- **Database-enforced** authorization
- **Comprehensive audit trails**
- **Best practices** throughout

Every security decision balances **safety**, **usability**, and **performance**.

The system is production-ready for a trust-based lost & found platform with appropriate security for sensitive user communications.

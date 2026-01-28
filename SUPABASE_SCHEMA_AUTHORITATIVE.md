# SUPABASE SCHEMA REFERENCE - AUTHORITATIVE

This document describes the ACTUAL tables in Supabase (from `supabase/schema.sql` and `supabase/admin_schema.sql`).

## PUBLIC SCHEMA (supabase/schema.sql)

### Core Tables
These tables DEFINITELY exist in Supabase and have data:

#### 1. user_profiles
```sql
- user_id (UUID, PK, from auth.users)
- email (String)
- full_name (String)
- avatar_url (String)
- role (ENUM: 'user', 'analyst', 'moderator', 'super_admin')
- trust_score (Integer, 0-100)
- is_banned (Boolean)
- ban_reason (String nullable)
- verified_at (Timestamp nullable)
- created_at (Timestamp)
- updated_at (Timestamp)
```

#### 2. categories
```sql
- id (UUID, PK)
- name (String)
- emoji (String)
- color (String)
- description (String)
- sort_order (Integer)
- created_at (Timestamp)
```

#### 3. areas
```sql
- id (UUID, PK)
- name (String)
- description (String)
- latitude (Float nullable)
- longitude (Float nullable)
- radius_km (Float)
- created_at (Timestamp)
```

#### 4. items
```sql
- id (UUID, PK)
- finder_id (UUID, FK → user_profiles.user_id) ✅ CORRECT COLUMN NAME
- category_id (UUID, FK → categories.id)
- area_id (UUID, FK → areas.id)
- title (String)
- description (Text)
- color (String nullable)
- brand (String nullable)
- date_found (Timestamp) ✅ NOT "found_date"
- location_details (String)
- security_question (String)
- contact_method (ENUM: 'in_app', 'phone', 'email')
- status (ENUM: 'active', 'claimed', 'returned', 'expired', 'removed') ✅ NOT 'unclaimed'
- view_count (Integer default 0)
- is_featured (Boolean default false)
- is_flagged (Boolean default false)
- is_deleted (Boolean default false)
- created_at (Timestamp)
- updated_at (Timestamp)
```

#### 5. item_images
```sql
- id (UUID, PK)
- item_id (UUID, FK → items.id)
- storage_bucket (String)
- storage_path (String)
- image_url (String)
- is_primary (Boolean)
- sort_order (Integer)
- created_at (Timestamp)
```

#### 6. claims
```sql
- id (UUID, PK)
- item_id (UUID, FK → items.id)
- claimer_id (UUID, FK → user_profiles.user_id)
- status (ENUM: 'pending', 'approved', 'rejected', 'completed', 'cancelled')
- approved_by (UUID nullable, FK → user_profiles.user_id)
- rejection_reason (String nullable)
- completed_at (Timestamp nullable)
- created_at (Timestamp)
- updated_at (Timestamp)
```

#### 7. claim_verification_answers
```sql
- id (UUID, PK)
- claim_id (UUID, FK → claims.id)
- answer (String)
- is_correct (Boolean)
- created_at (Timestamp)
```

#### 8. chats
```sql
- id (UUID, PK)
- item_id (UUID, FK → items.id)
- initiator_id (UUID, FK → user_profiles.user_id)
- responder_id (UUID, FK → user_profiles.user_id)
- status (ENUM: 'active', 'resolved', 'blocked')
- created_at (Timestamp)
- updated_at (Timestamp)
```

#### 9. messages
```sql
- id (UUID, PK)
- chat_id (UUID, FK → chats.id)
- sender_id (UUID, FK → user_profiles.user_id)
- content (Text)
- is_read (Boolean default false)
- created_at (Timestamp)
```

#### 10. abuse_reports
```sql
- id (UUID, PK)
- reporter_id (UUID, FK → user_profiles.user_id)
- reported_user_id (UUID nullable, FK → user_profiles.user_id)
- item_id (UUID nullable, FK → items.id)
- report_type (ENUM: 'spam', 'inappropriate', 'fraud', 'harassment', 'other')
- description (Text)
- status (ENUM: 'open', 'investigating', 'resolved', 'dismissed')
- created_at (Timestamp)
- updated_at (Timestamp)
```

#### 11. audit_logs
```sql
- id (UUID, PK)
- user_id (UUID nullable, FK → user_profiles.user_id)
- action (String)
- resource_type (String)
- resource_id (UUID nullable)
- changes (JSONB)
- created_at (Timestamp)
```

#### 12. rate_limits
```sql
- id (UUID, PK)
- user_id (UUID, FK → user_profiles.user_id)
- endpoint (String)
- count (Integer)
- window_start (Timestamp)
- created_at (Timestamp)
```

#### 13. image_hashes
```sql
- id (UUID, PK)
- image_url (String)
- hash (String)
- created_at (Timestamp)
```

---

## ADMIN SCHEMA EXTENSIONS (supabase/admin_schema.sql)

### Admin-Specific Tables
These tables ONLY exist if admin_schema.sql was applied:

#### 1. admin_users
```sql
- id (UUID, PK, from auth.users)
- is_active (Boolean default true)
- force_logout_at (Timestamp nullable)
- twofa_enabled (Boolean default false)
- twofa_secret (String nullable, encrypted in production)
- twofa_verified_at (Timestamp nullable)
- twofa_backup_codes (String[] nullable)
- created_at (Timestamp)
- updated_at (Timestamp)
```

#### 2. admin_audit_logs (IMMUTABLE)
```sql
- id (UUID, PK)
- admin_id (UUID, FK → admin_users.id)
- action (String)
- resource_type (String)
- resource_id (UUID nullable)
- status (ENUM: 'success', 'failure')
- details (JSONB)
- ip_address (String)
- user_agent (String)
- created_at (Timestamp, NOT updatable)
```

#### 3. admin_messages
```sql
- id (UUID, PK)
- sender_id (UUID, FK → admin_users.id)
- recipient_id (UUID nullable, FK → admin_users.id)
- subject (String)
- content (Text)
- is_read (Boolean default false)
- created_at (Timestamp)
```

#### 4. user_restrictions
```sql
- id (UUID, PK)
- user_id (UUID, FK → user_profiles.user_id)
- restriction_type (ENUM: 'upload_ban', 'claim_ban', 'chat_ban', 'full_ban')
- reason (String)
- expires_at (Timestamp nullable)
- created_by (UUID, FK → admin_users.id)
- created_at (Timestamp)
```

#### 5. user_warnings
```sql
- id (UUID, PK)
- user_id (UUID, FK → user_profiles.user_id)
- warning_type (String)
- description (String)
- severity (ENUM: 'low', 'medium', 'high')
- resolved_at (Timestamp nullable)
- created_by (UUID, FK → admin_users.id)
- created_at (Timestamp)
```

#### 6. trust_score_history
```sql
- id (UUID, PK)
- user_id (UUID, FK → user_profiles.user_id)
- old_score (Integer)
- new_score (Integer)
- reason (String)
- created_by (UUID nullable, FK → admin_users.id)
- created_at (Timestamp)
```

#### 7. claim_admin_notes
```sql
- id (UUID, PK)
- claim_id (UUID, FK → claims.id)
- admin_id (UUID, FK → admin_users.id)
- note (Text)
- created_at (Timestamp)
```

---

## WHAT DOES NOT EXIST

These tables ARE REFERENCED in code but DO NOT EXIST in Supabase:

❌ `platform_statistics_daily` - NEVER created, doesn't exist
❌ `reports` - Actual table name is `abuse_reports`
❌ `twofa_attempts` - Never created (but referenced in code)
❌ `admin_login_history` - Never created (but referenced in code)
❌ `item_moderation_log` - Removed in migration
❌ `admin_dashboard_summary` - Removed in migration
❌ `admin_flagged_items` - Removed in migration

---

## CRITICAL COLUMN DIFFERENCES

### WRONG vs RIGHT (Frontend Issue)
The admin frontend code uses WRONG column names:

```
WRONG (in adminSupabase.js)    →    RIGHT (in schema.sql)
─────────────────────────────────────────────────────
item.found_date                →    item.date_found
item.area                      →    item.area_id (then JOIN)
item.found_landmark            →    item.location_details
item.contact                   →    item.contact_method
'unclaimed'                    →    'active'
'closed'                       →    'returned'
'flagged'                      →    is_flagged = true
'deleted'                      →    is_deleted = true
```

---

## ENUM VALUES

### item_status (items.status)
```
✅ 'active'     - Item not yet claimed
✅ 'claimed'    - Claim approved, waiting for pickup
✅ 'returned'   - Item returned to finder / resolved
✅ 'expired'    - Too old, no longer searchable
✅ 'removed'    - Deleted by finder or admin
```

NOT valid:
❌ 'unclaimed'  - Old value, don't use
❌ 'closed'     - Old value, use 'returned'
❌ 'flagged'    - Not a status, use is_flagged boolean
❌ 'deleted'    - Use 'removed'

---

## WHAT MUST BE DEPLOYED

For admin pages to work, BOTH of these must be in Supabase:

1. ✅ `supabase/schema.sql` - Already deployed (core tables)
2. ⚠️ `supabase/admin_schema.sql` - May need to be deployed if admin pages are new

If admin_schema.sql hasn't been applied:
- admin_users table doesn't exist → backend can't verify admin status
- admin_audit_logs table doesn't exist → audit logging fails silently
- 2FA features don't work

---

## HOW TO VERIFY

Run this in Supabase SQL Editor to see all tables:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected output (21 tables):
- abuse_reports ✅
- admin_audit_logs ✅ (if admin schema applied)
- admin_messages ✅ (if admin schema applied)
- admin_users ✅ (if admin schema applied)
- areas ✅
- audit_logs ✅
- categories ✅
- chats ✅
- claim_admin_notes ✅ (if admin schema applied)
- claim_verification_answers ✅
- claims ✅
- image_hashes ✅
- item_images ✅
- items ✅
- messages ✅
- rate_limits ✅
- trust_score_history ✅ (if admin schema applied)
- user_profiles ✅
- user_restrictions ✅ (if admin schema applied)
- user_warnings ✅ (if admin schema applied)
- user_storage_usage ✅ (storage policies)

---

## NEXT STEPS

1. **REQUIRED**: Verify which tables exist in live Supabase (run SELECT above)
2. **IF MISSING**: Apply admin_schema.sql if admin tables don't exist
3. **FIX BACKEND**: Update `backend/nodejs/src/services/supabase.ts` to use correct table/column names
4. **FIX FRONTEND**: Update `frontend/src/admin/lib/adminSupabase.js` to use correct table/column names
5. **TEST**: Verify all queries work with actual Supabase data


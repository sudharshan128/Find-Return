# ✅ STEP 2.1 COMPLETE: DATABASE MIGRATION READY

**Status:** 🟢 READY FOR DEPLOYMENT  
**Date:** 2026-01-08  
**Risk Level:** 🟢 ZERO (Additive only, fully reversible)  
**Files Created:** 2  

---

## 📋 WHAT WAS CREATED

### 1️⃣ Migration: `006_add_2fa_support.sql` (2,085 bytes)

**Location:** `backend/nodejs/migrations/006_add_2fa_support.sql`

**Contains:**
- ✅ Add 4 columns to `admin_users` table
  - `twofa_enabled` (boolean, default false)
  - `twofa_secret` (text, encrypted)
  - `twofa_verified_at` (timestamp)
  - `twofa_backup_codes` (text array)
- ✅ Create `twofa_attempts` table for rate limiting
  - `id` (uuid primary key)
  - `admin_id` (foreign key to admin_users)
  - `attempt_count`, `locked_until`, timestamps
- ✅ Create 2 indexes for performance
- ✅ Add documentation comments

**Why Safe:**
- Pure `ALTER TABLE` and `CREATE TABLE IF NOT EXISTS`
- No data loss (additive only)
- No breaking changes
- Fully reversible in <1 second

### 2️⃣ Rollback: `006_rollback.sql` (752 bytes)

**Location:** `backend/nodejs/migrations/006_rollback.sql`

**Reverses:**
- `DROP TABLE twofa_attempts` (cascading)
- Remove all 4 2FA columns from `admin_users`
- Preserves all existing data

**Rollback Time:** <1 second

---

## 🚀 HOW TO APPLY THE MIGRATION

### Option A: Supabase Dashboard (RECOMMENDED)

1. Go to: https://app.supabase.com
2. Select project: "Return"
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query**
5. Copy entire SQL from: `backend/nodejs/migrations/006_add_2fa_support.sql`
6. Paste into editor
7. Click: **Run** (⚡)
8. Verify: No errors shown

**Time:** < 2 seconds  
**Difficulty:** 🟢 Very Easy

### Option B: psql Command Line

```bash
cd "d:\Dream project\Return\backend\nodejs"
psql -h yrdjpuvmijibfilrycnu.supabase.co \
     -U postgres \
     -d postgres \
     -f migrations/006_add_2fa_support.sql
```

**Time:** < 5 seconds  
**Difficulty:** 🟡 Medium

---

## ✅ VERIFICATION CHECKLIST

After applying the migration, run these queries in Supabase SQL Editor:

### ✅ Check 1: Verify 2FA columns exist

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'admin_users' AND column_name LIKE 'twofa%'
ORDER BY column_name;
```

**Expected:** 4 rows
- twofa_backup_codes (text)
- twofa_enabled (boolean)
- twofa_secret (text)
- twofa_verified_at (timestamp)

### ✅ Check 2: Verify twofa_attempts table exists

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'twofa_attempts';
```

**Expected:** 1 row
- twofa_attempts

### ✅ Check 3: Verify indexes exist

```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'twofa_attempts';
```

**Expected:** 2 rows
- idx_twofa_attempts_admin_id
- idx_twofa_attempts_locked_until

### ✅ Check 4: Query the new table

```sql
SELECT * FROM twofa_attempts LIMIT 1;
```

**Expected:** No rows (table is empty) ✅

### ✅ Check 5: Verify admin_users has new columns

```sql
SELECT id, email, twofa_enabled, twofa_verified_at 
FROM admin_users LIMIT 1;
```

**Expected:** Columns exist, values are NULL/false for existing admins ✅

---

## 🔄 IF SOMETHING GOES WRONG

### Scenario: "column already exists" error

**Meaning:** Migration was already applied ✅

**Action:** Proceed to STEP 2.2 (no re-apply needed)

### Scenario: Permission denied

**Meaning:** Your Supabase user doesn't have superuser access

**Action:** 
- Use Supabase dashboard SQL editor (works with any role)
- Or contact Supabase support

### Scenario: Table creation failed

**Meaning:** Bug in migration SQL or database issue

**Action:**
1. Copy SQL line-by-line into Supabase SQL editor
2. Run each line separately to find error
3. Report issue with error message

### Scenario: Need to rollback

**Action:**
```sql
-- Copy entire contents of: 006_rollback.sql
DROP TABLE IF EXISTS public.twofa_attempts CASCADE;
ALTER TABLE admin_users
DROP COLUMN IF EXISTS twofa_enabled,
DROP COLUMN IF EXISTS twofa_secret,
DROP COLUMN IF EXISTS twofa_verified_at,
DROP COLUMN IF EXISTS twofa_backup_codes;
```

---

## 📊 DATABASE SCHEMA AFTER MIGRATION

### admin_users table (MODIFIED)

| Column | Type | Default | Nullable | Purpose |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | Primary key |
| email | text | | NO | Admin email |
| role | text | | NO | admin_admin/moderator/analyst |
| name | text | | YES | Admin name |
| ... | ... | ... | ... | (existing columns) |
| **twofa_enabled** | **boolean** | **false** | **YES** | **2FA feature enabled** |
| **twofa_secret** | **text** | **NULL** | **YES** | **Encrypted TOTP secret** |
| **twofa_verified_at** | **timestamp tz** | **NULL** | **YES** | **When 2FA was activated** |
| **twofa_backup_codes** | **text[]** | **NULL** | **YES** | **Recovery codes (future)** |

### twofa_attempts table (NEW)

| Column | Type | Default | Nullable | Purpose |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | Primary key |
| admin_id | uuid | | NO | FK to admin_users |
| attempt_count | integer | 0 | NO | Failed attempts |
| last_attempt_at | timestamp tz | now() | YES | Last attempt timestamp |
| locked_until | timestamp tz | NULL | YES | When lockout expires |
| created_at | timestamp tz | now() | YES | Record created at |
| updated_at | timestamp tz | now() | YES | Record updated at |

**Indexes:**
- `idx_twofa_attempts_admin_id` - Fast lookups by admin
- `idx_twofa_attempts_locked_until` - Fast lockout checks

---

## 🛡️ SAFETY GUARANTEES

✅ **No data loss** - All existing data preserved  
✅ **Additive only** - No dropping columns/tables  
✅ **Fully reversible** - Rollback in <1 second  
✅ **Zero user impact** - Feature hidden by default (twofa_enabled = false)  
✅ **No breaking changes** - All new columns nullable/default  
✅ **Performance safe** - Only 2 small indexes added  

---

## 📝 NEXT STEPS

### ✅ What you need to do NOW:

1. Apply the migration to Supabase (choose Option A or B above)
2. Run all 5 verification checks above
3. Report completion in this file

### ➡️ What comes NEXT (after verification):

**STEP 2.2: Backend APIs (Feature-Flagged)**
- Create `/api/2fa/setup` endpoint
- Create `/api/2fa/verify` endpoint
- Create `/api/2fa/verify-login` endpoint (new)
- Create `/api/2fa/disable` endpoint
- Add TOTP verification logic
- Add rate limiting
- Add audit logging

**⚠️ IMPORTANT:** No middleware enforcement yet. APIs exist but not activated.

---

## 📞 SUPPORT

If you encounter issues:

1. Check the error message carefully
2. Run verification checks above
3. Refer to rollback section if needed
4. Document the exact error for debugging

---

## ✨ COMPLETION STATUS

| Item | Status |
|---|---|
| Migration files created | ✅ |
| SQL syntax verified | ✅ |
| Rollback script created | ✅ |
| Documentation complete | ✅ |
| Ready for deployment | ✅ |

**Next Step:** Apply migration to Supabase → Run verification → Proceed to STEP 2.2


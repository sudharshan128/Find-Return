# 🔐 STEP 2.1: DATABASE MIGRATION - MANUAL EXECUTION

## ⚠️ IMPORTANT: This must be done via Supabase Dashboard

The 2FA database migration adds 4 new columns to `admin_users` and creates a new `twofa_attempts` table for rate limiting.

### 🔗 HOW TO APPLY THE MIGRATION

#### Option 1: Supabase SQL Editor (RECOMMENDED)

1. Open Supabase Dashboard: https://app.supabase.com
2. Select your project: `Return`
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy-paste the entire SQL from `backend/nodejs/migrations/006_add_2fa_support.sql`
6. Click **Run** (⚡)
7. Verify output: Should see ✅ without errors

#### Option 2: psql Command Line

If you have psql installed locally:

```bash
export PGPASSWORD="your-postgres-password"
psql -h yrdjpuvmijibfilrycnu.supabase.co \
     -U postgres \
     -d postgres \
     -f backend/nodejs/migrations/006_add_2fa_support.sql
```

#### Option 3: Node Script (Automated - Requires Setup)

```bash
cd backend/nodejs
node scripts/db-migrate.js
```

---

## ✅ VERIFICATION AFTER MIGRATION

Run these queries in Supabase SQL Editor to verify:

### Check 1: Verify 2FA columns were added
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'admin_users'
  AND column_name LIKE 'twofa%'
ORDER BY ordinal_position;
```

**Expected Result:**
| column_name | data_type | column_default |
|---|---|---|
| twofa_enabled | boolean | false |
| twofa_secret | text | null |
| twofa_verified_at | timestamp with time zone | null |
| twofa_backup_codes | text[] | null |

### Check 2: Verify twofa_attempts table exists
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'twofa_attempts';
```

**Expected Result:**
| table_name |
|---|
| twofa_attempts |

### Check 3: Verify indexes were created
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'twofa_attempts';
```

**Expected Result:**
| indexname |
|---|
| idx_twofa_attempts_admin_id |
| idx_twofa_attempts_locked_until |

### Check 4: Verify column comments
```sql
SELECT column_name, pg_description.description
FROM information_schema.columns
JOIN pg_class ON information_schema.columns.table_name = pg_class.relname
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
JOIN pg_attribute ON pg_attribute.attrelid = pg_class.oid AND information_schema.columns.ordinal_position = pg_attribute.attnum
JOIN pg_description ON pg_attribute.attrelid = pg_description.objoid AND pg_attribute.attnum = pg_description.objsubobjid
WHERE table_name = 'admin_users' AND column_name LIKE 'twofa%';
```

---

## 🚨 IF MIGRATION FAILS

### Error: "column twofa_enabled already exists"
- The migration was already applied ✅
- No action needed

### Error: "permission denied"
- You don't have superuser access
- Contact Supabase support or re-check your permissions

### Error: "syntax error in SQL"
- Copy-paste the SQL exactly from the migration file
- Don't manually edit the SQL

---

## 🔄 IF YOU NEED TO ROLLBACK

Run the rollback SQL from `backend/nodejs/migrations/006_rollback.sql`:

```sql
DROP TABLE IF EXISTS public.twofa_attempts CASCADE;

ALTER TABLE admin_users
DROP COLUMN IF EXISTS twofa_enabled,
DROP COLUMN IF EXISTS twofa_secret,
DROP COLUMN IF EXISTS twofa_verified_at,
DROP COLUMN IF EXISTS twofa_backup_codes;
```

Then verify:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'admin_users' AND column_name LIKE 'twofa%';
-- Should return 0 rows
```

---

## 📝 NEXT STEPS

Once migration is verified:

1. ✅ Database changes applied
2. 🔄 Run verification queries above
3. 📋 Document in this file that migration was successful
4. ➡️  Proceed to STEP 2.2: Backend APIs (feature-flagged, no middleware)

---

## 📊 MIGRATION SUMMARY

| Component | Change | Risk | Impact |
|---|---|---|---|
| admin_users table | +4 columns | 🟢 Low | Additive, no breaking change |
| twofa_attempts table | NEW | 🟢 Low | New table, optional feature |
| admin_audit_logs | Comment update | 🟢 None | Documentation only |

**Total Risk Level: 🟢 ZERO** - All changes are additive and can be rolled back instantly.


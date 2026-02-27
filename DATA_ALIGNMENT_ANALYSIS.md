# DATA ALIGNMENT ANALYSIS & RESTORATION PLAN

## 🚨 CRITICAL FINDINGS

### Schema Mismatch Detected

**TWO CONFLICTING SCHEMA FILES EXIST:**

1. **`supabase/schema.sql`** (MODERN - 998 lines)
   - Tables: `user_profiles`, `items`, `item_images`, `claims`, etc.
   - Status enum: `item_status AS ENUM ('active', 'claimed', 'returned', 'expired', 'removed')`
   - Proper views and analytics support
   - **ISSUE**: Has `date_found` column but admin code expects `found_date`
   - **ISSUE**: `finder_id` foreign key vs code expecting `items_finder_id_fkey`

2. **`sql/schema.sql`** (LEGACY - 416 lines)
   - Tables: `users` (not `user_profiles`), `items`, `claims`, etc.
   - Status enum: `item_status AS ENUM ('unclaimed', 'claimed', 'closed', 'flagged', 'deleted')`
   - Minimal views
   - **ORPHANED**: Not used by frontend

3. **`supabase/admin_schema.sql`** (ADMIN TABLES - 950+ lines)
   - Extends main schema with admin-specific tables
   - References `admin_users`, `admin_audit_logs`, etc.
   - **ISSUE**: May not be applied to live Supabase

### Frontend Code Misalignments

**Public Site** (`frontend/src/lib/supabase.js`):
- ✅ Correctly references `user_profiles` table
- ✅ Uses correct status values: `'active'` (maps from UI `'unclaimed'`)
- ✅ Correctly handles `item_images` table
- ✅ Correctly handles `item_images` FK relationships

**Admin Site** (`frontend/src/admin/lib/adminSupabase.js`):
- ❌ References outdated table names
- ❌ May reference wrong columns or deleted enums
- ❌ Inconsistent with main schema

### Data Flow Breakage Points

**PUBLIC PAGES** (affected):
- HomePage.jsx fetches `db.items.search()`
  - Expected tables: `items`, `categories`, `areas`, `item_images`
  - Expected columns: `finder_id`, `category_id`, `area_id`, `status`
  - Likely issue: Query running but tables may be empty OR column mismatches

**ADMIN PAGES** (severely affected):
- Uses `adminSupabase` module (outdated)
- Queries tables that may not exist or have wrong names
- References deleted columns

---

## 📋 RESTORATION PLAN

### PHASE 1: VERIFY LIVE SUPABASE SCHEMA (TODAY)
1. Connect to live Supabase
2. Run: `SELECT tablename FROM pg_tables WHERE schemaname='public'`
3. Verify which schema version is actually applied
4. Check existing data count in each table

### PHASE 2: STANDARDIZE ON SINGLE SCHEMA
**Decision**: Use `supabase/schema.sql` as AUTHORITATIVE source
- It's modern, well-documented
- Frontend public pages already aligned to it
- Has admin features via `admin_schema.sql`

**Action**:
- ✅ Keep `supabase/schema.sql` (production schema)
- ✅ Keep `supabase/admin_schema.sql` (admin extensions)
- ❌ DELETE `sql/schema.sql` (legacy, conflicting)
- ✅ Update all code to use unified schema

### PHASE 3: ALIGN FRONTEND PUBLIC CODE
**Current Status**: Already mostly correct
- No changes needed to `frontend/src/lib/supabase.js`
- Tables match: `user_profiles`, `items`, `categories`, `areas`, `item_images`
- Status mapping correct: UI `'unclaimed'` → DB `'active'`

### PHASE 4: FIX ADMIN CODE
**Files to Fix**:
1. `frontend/src/admin/lib/adminSupabase.js` - COMPLETE REWRITE
   - Use correct table names from modern schema
   - Use correct column names
   - Use correct enum values
   - Remove references to non-existent tables

2. Update all admin pages to use correct API calls

### PHASE 5: FIX BACKEND CODE  
**Files to Fix**:
1. Backend routes to query modern schema
2. All endpoints to use correct table/column names
3. All endpoints to use correct enum values

### PHASE 6: DATA VERIFICATION
1. Restore any lost data from backups
2. Verify relationships are intact
3. Verify RLS policies work correctly

---

## 🔧 EXACT CHANGES NEEDED

### Table Name Mapping
```
sql/schema.sql          →  supabase/schema.sql
────────────────────────────────────────────────
users                   →  user_profiles
items.finder_id         →  items.finder_id ✅
claims.claimant_id      →  claims.claimant_id ✅
(mostly same names)
```

### Column Name Corrections
```
WRONG (old admin code)  →  CORRECT (new schema)
──────────────────────────────────────────────────
found_date              →  date_found
found_landmark          →  location_details
found_location          →  location_details
private_notes           →  security_question
(check adminSupabase.js line by line)
```

### Enum Value Corrections
```
sql/schema.sql          →  supabase/schema.sql
────────────────────────────────────────────────
'unclaimed'             →  'active'
'claimed'               →  'claimed'
'closed'                →  'returned'
'flagged'               →  'flagged' (still exists)
'deleted'               →  'removed'
```

### Admin-Specific Tables (Must Exist)
```
admin_users             - Auth/admin user records
admin_audit_logs        - Immutable action log
user_warnings           - User warnings (soft warnings)
user_restrictions       - User restrictions (chat freeze, claim block)
claim_admin_notes       - Admin notes on claims
item_moderation_log     - Item moderation history
system_settings         - Admin config
```

---

## ✅ SUCCESS CRITERIA

After fix, these must work:

**Public Site**:
- [ ] HomePage loads items without white screen
- [ ] Items display with correct data
- [ ] Search/filters work
- [ ] Upload new item works
- [ ] View item details works
- [ ] Make claim works
- [ ] Old uploaded items visible

**Admin Site**:
- [ ] Admin login works
- [ ] Dashboard loads stats
- [ ] Items page shows all items with correct status
- [ ] Users page shows all users
- [ ] Claims page shows all claims
- [ ] Moderation features work
- [ ] Audit logs appear
- [ ] Settings page works

**Data Integrity**:
- [ ] All existing data preserved
- [ ] No data loss
- [ ] Relationships intact
- [ ] RLS policies enforced

---

## 🚀 EXECUTION STEPS

1. **Verify Current Supabase**: Check which schema is live
2. **Apply Modern Schema**: If needed, run `supabase/schema.sql`
3. **Apply Admin Extensions**: Run `supabase/admin_schema.sql`
4. **Fix Frontend Admin Code**: Update `adminSupabase.js`
5. **Fix Backend Code**: Update routes and queries
6. **Verify Data**: Run test queries
7. **Test Full Flow**: Public + Admin complete workflows

---

## 📊 CURRENT STATUS

| Component | Status | Issue |
|-----------|--------|-------|
| Supabase | Unknown | Need to verify live schema |
| Frontend Public | ✅ Ready | Code matches modern schema |
| Frontend Admin | ❌ Broken | Code uses outdated schema |
| Backend | ❌ Broken | Routes use wrong table names |
| Data | ❓ Unknown | May be lost or corrupted |


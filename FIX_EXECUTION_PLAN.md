# COMPREHENSIVE DATA RESTORATION & FIX PLAN

## PHASE 1: SCHEMA STANDARDIZATION

### Current Situation
- **supabase/schema.sql**: Modern, complete, well-documented (998 lines)
- **sql/schema.sql**: Legacy, incomplete (416 lines)  
- **supabase/admin_schema.sql**: Admin extensions (950+ lines)
- **Backend code**: Queries non-existent tables
- **Admin frontend code**: References wrong table/column names

### Decision
**USE `supabase/schema.sql` as the AUTHORITATIVE schema**

Reasoning:
- More complete and modern
- Has all necessary tables and relationships
- Frontend public code already aligned to it
- Supports analytics properly

### Action Items

#### 1. DELETE LEGACY SCHEMA (sql/schema.sql)
**Reason**: Conflicting, unused by modern frontend
**Action**: Remove to prevent confusion

#### 2. VERIFY LIVE SUPABASE MATCHES `supabase/schema.sql`
**Required Tables**:
- `user_profiles` (not `users`)
- `categories`
- `areas`
- `items`
- `item_images`
- `claims`
- `claim_verification_answers`
- `chats`
- `messages`
- `abuse_reports`
- `audit_logs`
- Plus admin tables from `admin_schema.sql`

#### 3. ENSURE ADMIN SCHEMA IS APPLIED
Run `supabase/admin_schema.sql` to create:
- `admin_users`
- `admin_audit_logs`
- `user_warnings`
- `user_restrictions`
- `claim_admin_notes`
- `item_moderation_log`
- `system_settings`

---

## PHASE 2: BACKEND QUERY FIXES

### Files to Fix
- `backend/nodejs/src/services/supabase.ts` - Fix all Supabase queries

### Specific Issues & Fixes

#### Issue 1: Non-existent `platform_statistics_daily` table
**Current Code**:
```typescript
const statsData = await this.clientService.from("platform_statistics_daily").select("*");
```

**Problem**: Table doesn't exist
**Solution**: Calculate stats from actual tables (items, claims, etc.)

#### Issue 2: Wrong column names
**Current**: Queries `items.area` (doesn't exist)
**Correct**: Should query `items.area_id` and JOIN with `areas` table

#### Issue 3: Missing table definitions
Backend tries to query `admin_users` without proper field definitions

### How Frontend Public Code Works (Reference)
```javascript
db.items.search({...}) // Works correctly
// Queries: items → categories, areas, item_images (all exist)
// Uses correct column names: finder_id, category_id, area_id, status
// Status: 'active' or other valid enum values
```

---

## PHASE 3: FRONTEND ADMIN CODE FIXES

### File: `frontend/src/admin/lib/adminSupabase.js`
This file has 1700+ lines of completely incorrect queries

### Strategy
**COMPLETE REWRITE** to:
1. Query actual tables from modern schema
2. Use correct column names
3. Use correct foreign key relationships
4. Use correct enum values

### Key Fixes Needed

#### Tables & Columns
```
WRONG                           RIGHT
─────────────────────────────────────────────────
from('items_view')       →  from('items') JOIN relationships
from('admin_flagged_items')  →  from('items') WHERE is_flagged = true
item.area                →  item.area_id (need to JOIN areas)
item.found_date          →  item.date_found
item.found_landmark      →  item.location_details
```

#### Enum Values
```
'unclaimed'  →  'active'
'closed'     →  'returned'  
'deleted'    →  'removed'
```

#### Admin Tables
```
from('admin_users')          - Correct
from('admin_audit_logs')     - Correct
from('claim_admin_notes')    - Correct
from('user_warnings')        - Correct
```

---

## PHASE 4: DATA PRESERVATION & RESTORATION

### Critical Data to Preserve
1. All items uploaded by users
2. All user profiles
3. All claims
4. All chats/messages
5. All audit logs

### Process
1. Export existing data from live Supabase (if any)
2. Verify schema matches `supabase/schema.sql`
3. Re-import data if needed
4. Verify relationships intact
5. Verify RLS policies working

---

## PHASE 5: TESTING & VERIFICATION

### Public Site Tests
- [ ] HomePage loads without error
- [ ] Items display with images
- [ ] Search works
- [ ] Category/Area filters work
- [ ] Can upload new item
- [ ] Can view item details
- [ ] Can make claim
- [ ] Can chat after claim approved

### Admin Site Tests  
- [ ] Admin login works
- [ ] Dashboard shows stats
- [ ] Items page loads all items
- [ ] Can see correct item status ('active', 'returned', etc.)
- [ ] Users page loads
- [ ] Claims page loads
- [ ] Can moderate items (flag, hide, etc.)
- [ ] Audit logs show admin actions
- [ ] Settings page works

### Data Integrity Tests
- [ ] No data loss
- [ ] Relationships valid
- [ ] RLS policies enforced
- [ ] Old items still visible
- [ ] New items save correctly

---

## SUCCESS CRITERIA

✅ All public pages load without white screen
✅ All admin pages load without white screen  
✅ Items show with correct data
✅ User can upload, browse, claim items
✅ Admin can manage users, items, claims
✅ All data persists in Supabase
✅ No infinite loading
✅ Error messages appear when something fails
✅ System works "exactly like before Node.js was added — but secure"

---

## EXECUTION ORDER

1. **Verify Live Supabase Schema** (read-only, no changes yet)
2. **Fix Backend Queries** (update supabase.ts)
3. **Fix Admin Frontend Code** (update adminSupabase.js)
4. **Test Data Flow** (verify queries work)
5. **Restore Any Lost Data** (if needed)
6. **Full End-to-End Test** (public + admin workflows)


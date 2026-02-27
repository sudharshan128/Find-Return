# Item Detail Page - Supabase Foreign Key Fix (FINAL)

## Issue Summary
Users could see items on the HomePage but clicking to open ItemDetailPage resulted in:
- **Error**: `Could not embed because more than one relationship was found for 'items' and 'user_profiles'` (Supabase error PGRST201)
- **Result**: "Item not found" error message + redirect to home
- **Root Cause**: Ambiguous foreign key relationship in Supabase query

## Root Cause Analysis

### The Problem
The `items` table has **TWO** foreign keys pointing to `user_profiles`:
1. `finder_id` → user_profiles(user_id) - the item uploader
2. `flagged_by` → user_profiles(user_id) - optional moderator who flagged item

When the query used an ambiguous join like:
```javascript
finder:user_profiles(...)  // Which FK? finder_id or flagged_by?
```

Supabase couldn't determine which foreign key to use, causing PGRST201 error.

### Supabase FK Syntax Rules
- **Single FK**: Can use `relation(*)` - Supabase auto-resolves
- **Multiple FKs**: Must use `relation!constraint_name(...)` - explicit FK required

## Solution

### Fixed Query Syntax
Use the explicit **Supabase constraint name** (auto-generated from column):

```javascript
// Format: alias:table!constraint_name(fields)
// Constraint name = table_column_fkey (Supabase convention)
finder:user_profiles!items_finder_id_fkey(user_id, full_name, avatar_url, trust_score, items_returned_count)
```

## Files Modified

### 1. frontend/src/lib/supabase.js

#### Fix 1: items.get() - Line 310
**Purpose**: Fetch single item details (ItemDetailPage)

**Before** (❌ BROKEN):
```javascript
finder:user_profiles!finder_id(user_id, full_name, avatar_url, trust_score, items_returned_count),
```

**After** (✅ FIXED):
```javascript
finder:user_profiles!items_finder_id_fkey(user_id, full_name, avatar_url, trust_score, items_returned_count),
```

#### Fix 2: admin.getAllItems() - Line 932
**Purpose**: Fetch all items for admin dashboard

**Before** (❌ BROKEN):
```javascript
finder:user_profiles(user_id, full_name, email, avatar_url, trust_score),
```

**After** (✅ FIXED):
```javascript
finder:user_profiles!items_finder_id_fkey(user_id, full_name, email, avatar_url, trust_score),
```

## Why This Works

### Supabase Constraint Naming Convention
Supabase auto-generates constraint names following PostgreSQL convention:
```
table_column_fkey
```

For the `items` table:
- `items.finder_id` → constraint name: `items_finder_id_fkey`
- `items.flagged_by` → constraint name: `items_flagged_by_fkey`

By specifying `!items_finder_id_fkey`, Supabase knows to use the `finder_id` FK specifically.

### Other Tables Status
✅ **No changes needed** for:
- `claims.claimant_id` - only one FK to user_profiles
- `messages.sender_id` - only one FK to user_profiles  
- `audit_logs.user_id` - only one FK to user_profiles
- `abuse_reports` - already uses explicit FK hints (`!reporter_id`, `!target_user_id`)

## Testing

### Test Case 1: Item Detail Page (Logged Out)
1. Navigate to HomePage
2. Click any item
3. ✅ ItemDetailPage loads without error
4. ✅ Item title, images, and uploader name display correctly

### Test Case 2: Item Detail Page (Logged In)
1. Login via Google
2. Navigate to HomePage  
3. Click an item
4. ✅ ItemDetailPage loads
5. ✅ "Claim This Item" button appears
6. ✅ Can see finder's profile info

### Test Case 3: HomePage Still Works
1. Navigate to HomePage
2. ✅ Items list loads
3. ✅ Can filter by category, area
4. ✅ Can search for items

### Test Case 4: Admin Dashboard
1. Login as admin
2. Navigate to Admin → Items
3. ✅ All items load with finder info
4. ✅ Can filter/search items

## Error Details Explained

### Before Fix - Console Error
```
Error: Could not embed because more than one relationship was found 
for 'items' and 'user_profiles'

Details: {
  code: 'PGRST201',
  message: 'Ambiguous foreign key...',
  status: 400
}
```

### After Fix - Success
```
✅ Item loaded
✅ Finder profile: { user_id, full_name, avatar_url, trust_score, items_returned_count }
✅ Images loaded
✅ Categories and areas resolved
```

## Database Schema (Reference)

```sql
-- items table has TWO FK to user_profiles
CREATE TABLE public.items (
    id UUID PRIMARY KEY,
    finder_id UUID NOT NULL REFERENCES user_profiles(user_id),  -- FK1
    category_id UUID NOT NULL REFERENCES categories(id),
    area_id UUID NOT NULL REFERENCES areas(id),
    ...
    flagged_by UUID REFERENCES user_profiles(user_id),          -- FK2
    ...
);
```

## Verification Checklist

- [x] Fixed items.get() with explicit FK constraint
- [x] Fixed admin.getAllItems() with explicit FK constraint
- [x] Verified no other items queries need fixing
- [x] Verified other tables don't have multiple FK to user_profiles
- [x] No changes to ItemDetailPage.jsx needed
- [x] No changes to HomePage or filters needed
- [x] Public (anon) reads still work without auth
- [x] Authenticated reads work with user context

## Impact Summary

✅ **Fixes**: ItemDetailPage now loads correctly on click
✅ **Preserves**: HomePage, admin, filters, search all unchanged
✅ **Scope**: Only query syntax fixed, no schema/data changes
✅ **Backward Compatible**: Existing data unaffected
✅ **Performance**: No impact (same query structure)

## Deploy Notes

1. Pull the updated `frontend/src/lib/supabase.js`
2. No database migrations needed
3. No environment variable changes
4. Test ItemDetailPage on click (all browsers)
5. Verify admin items dashboard loads
6. Check filters/search still work

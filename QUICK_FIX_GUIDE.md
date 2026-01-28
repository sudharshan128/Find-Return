# QUICK FIX: Upload 400 Error - Action Steps

## Problem
Upload fails with HTTP 400 because RLS policies reference non-existent `account_status` column.

## Solution - 3 Easy Steps

### Step 1: Open Supabase SQL Editor
Go to your Supabase project → **SQL Editor** (left sidebar)

### Step 2: Copy and Paste the Fix
Open file: **[CRITICAL_FIX_RLS_POLICY.sql](CRITICAL_FIX_RLS_POLICY.sql)**

Copy the ENTIRE contents and paste into Supabase SQL Editor.

### Step 3: Run the SQL
Click the **"RUN"** button (or Ctrl+Enter) to execute all the fixes.

Expected output: 6 DROP/CREATE operations complete, no errors.

---

## Verify the Fix Worked

### In Supabase (optional):
Run this query to verify:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'items' 
AND policyname = 'items_insert_own';
```
Should show the policy with just `finder_id = auth.uid()`, nothing about account_status.

### In the App (required):
1. Go back to browser with Lost & Found app
2. Click "Report Found" or "Upload Item" button
3. Fill out the form completely
4. Click "Submit Item"
5. **Should succeed** ✅ and show item on homepage

### In Browser Console:
Should see:
```
[db.items.create] Item created successfully with ID: <uuid>
```

---

## What If It Still Fails?

### Check the error message in console:
- "item_images table error" → Wait, images might still be processing
- "duplicate key" → Item already exists  
- Any other error → Screenshot it and share

### Try a simple test:
Instead of uploading real item, try with minimal data:
- Title: "Test"
- Description: "Test item"
- Area: Any area
- Date: Today
- Image: Any image
- Security question: "Is this a test?"

If this works, your data was invalid before.

---

## Estimated Time
- Applying fix: 2 minutes
- Testing upload: 2 minutes
- **Total: 5 minutes**

---

## Status Checklist
- [ ] Copy CRITICAL_FIX_RLS_POLICY.sql contents
- [ ] Paste into Supabase SQL Editor
- [ ] Click RUN
- [ ] Wait for completion (should say 6 operations)
- [ ] Refresh app in browser
- [ ] Try uploading an item
- [ ] Check console for success message
- [ ] Item should appear on homepage

✅ **That's it! Uploads should now work!**

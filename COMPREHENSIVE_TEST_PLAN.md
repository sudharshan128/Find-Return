# COMPREHENSIVE TEST PLAN
**Lost & Found Platform - System Restoration**  
**Date:** January 9, 2026

---

## TEST ENVIRONMENT SETUP

### Prerequisites
1. Backend running: `cd backend/nodejs && npm run dev`
2. Frontend running: `cd frontend && npm run dev`
3. Supabase database migrated: `supabase/schema.sql` + `supabase/storage_policies.sql`
4. Browser: Chrome/Firefox with DevTools open
5. Test Google account (2 needed: one admin, one regular user)

### Before Testing
- Clear browser cache: DevTools → Application → Clear site data
- Check Supabase dashboard for data
- Verify storage bucket exists: `item-images`
- Verify tables exist: `user_profiles`, `items`, `item_images`

---

## TEST CASE 1: New User First-Time Upload (CRITICAL)

**Objective:** Verify new user can sign up and upload images

**Steps:**
1. Open browser in **private/incognito mode** (fresh session)
2. Navigate to `http://localhost:5173/`
3. Click **"Sign In to Upload"** button
4. Complete Google OAuth with test account
5. Should redirect to home page with login success
6. Click **"Upload Found Product"** button
7. Fill form:
   - Category: "Phone"
   - Details: "Black iPhone"
   - Location: Select an area
   - Date: Today
   - Color: "Black"
   - Security Q: "Where was it found?"
8. Click **"Next"** through all steps
9. Step 4: **Upload image** (select any JPG/PNG from computer)
10. Verify image preview shows
11. Complete final confirmation
12. Click **"Submit"** button

**Expected Results:**
- ✅ Image uploads (progress bar shows)
- ✅ Item created successfully
- ✅ Redirected to item detail page
- ✅ Image displays on detail page
- ✅ No errors in browser console

**Console Checks:**
```javascript
// Should see these logs:
// [UploadItemPage] ====== SUBMIT STARTED ======
// [UploadItemPage] Image 1 uploaded: https://...
// [UploadItemPage] Item created successfully: {item-id}
```

**Verification:**
1. Go back to home page
2. Verify item appears in grid
3. Verify image shows in card thumbnail
4. Click item → image displays full size

---

## TEST CASE 2: Verify user_profiles Auto-Creation

**Objective:** Confirm auto-profile creation works

**Steps:**
1. Complete Test Case 1 first
2. Open browser DevTools → Console
3. Run this JavaScript:
```javascript
// Check if profile exists
const user = localStorage.getItem('sb-auth-user');
console.log('Auth user:', user);
```

4. Go to Supabase Dashboard → SQL Editor
5. Run query:
```sql
SELECT * FROM public.user_profiles 
WHERE email = '{test-email}' 
LIMIT 1;
```

**Expected Results:**
- ✅ Query returns 1 row (the auto-created profile)
- ✅ Fields populated:
  - `user_id` = auth user ID
  - `email` = test email
  - `full_name` = from Google profile
  - `role` = 'user'
  - `trust_score` = 100
  - `account_status` = 'active'

---

## TEST CASE 3: Image Storage Verification

**Objective:** Confirm image stored in Supabase Storage

**Steps:**
1. After Test Case 1 completes
2. Go to Supabase Dashboard → Storage
3. Click **"item-images"** bucket
4. Should see folder: `{user-id-uuid}`
5. Inside should be file: `{timestamp}-{random}.jpg`
6. Click file → should show preview

**Expected Results:**
- ✅ File exists in storage
- ✅ File size reasonable (100KB-2MB for image)
- ✅ Preview shows uploaded image
- ✅ Public URL works (click → opens in new tab)

---

## TEST CASE 4: Image Database Record Verification

**Objective:** Confirm image URL saved correctly in database

**Steps:**
1. After Test Case 1 completes
2. Go to Supabase Dashboard → SQL Editor
3. Run query:
```sql
SELECT 
  id,
  item_id, 
  storage_bucket,
  storage_path,
  image_url,
  is_primary,
  created_at
FROM public.item_images
WHERE item_id = '{from test case 1}'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**
- ✅ Query returns 1 row
- ✅ `storage_bucket` = 'item-images'
- ✅ `storage_path` = '{user-id}/{timestamp}.jpg'
- ✅ `image_url` = full public URL (starts with https://)
- ✅ `is_primary` = true
- ✅ `created_at` = recent timestamp

---

## TEST CASE 5: Homepage Display Verification

**Objective:** Confirm image displays correctly on homepage

**Steps:**
1. After Test Cases 1-4 pass
2. Navigate to home page: `http://localhost:5173/`
3. Scroll to **"Browse Items"** section
4. Should see item grid
5. Look for newly created item
6. Verify:
   - Image thumbnail displays
   - No placeholder/broken image icons
   - Image quality good
   - Title shows correct
   - Category/location show correct

**Expected Results:**
- ✅ Item card displays image thumbnail
- ✅ Hover: Image zoom effect
- ✅ Click card → Item detail page
- ✅ Detail page: Full image displays
- ✅ No broken image errors

---

## TEST CASE 6: Image Persistence (Refresh Test)

**Objective:** Confirm image persists after page refresh

**Steps:**
1. After Test Case 5 passes
2. Item detail page showing image
3. Press **F5** (refresh page)
4. Wait for page reload
5. Verify image still displays

**Expected Results:**
- ✅ Image loads again after refresh
- ✅ No "loading" spinner stays
- ✅ Image fully displays
- ✅ URL hasn't changed

---

## TEST CASE 7: Database Not Migrated Error

**Objective:** Verify homepage shows helpful error when DB not migrated

**Steps:**
1. Set up fresh test environment
2. **Don't run** `supabase/schema.sql`
3. Navigate to home page
4. Should show error banner

**Expected Error:**
- 🔶 Database Setup Banner appears
- 🔶 Message: "Database tables haven't been created"
- 🔶 Shows SQL file path
- 🔶 Instructions to run migration
- 🔶 Has retry button

---

## TEST CASE 8: Network Error Handling

**Objective:** Verify homepage shows helpful error when offline

**Steps:**
1. Home page loaded with items
2. Open DevTools → Network tab
3. Click "Offline" checkbox (or use browser offline mode)
4. Refresh page
5. Should show error banner

**Expected Error:**
- 🔴 Network Error Banner appears
- 🔴 Message: "Unable to connect to server"
- 🔴 "Check your internet connection"
- 🔴 Has retry button
- ✅ Click retry → waits for connection

---

## TEST CASE 9: File Upload Validation (Size)

**Objective:** Verify upload rejects files larger than 5MB

**Steps:**
1. Start new upload (Test Case 1 steps 1-9)
2. **Instead of normal image**, select large file:
   - Create test file: 10MB dummy image
   - Or use existing large image
3. Try to upload
4. Should show error before upload starts

**Expected Error:**
- 🔴 Error message: "File is larger than 5MB limit"
- 🔴 Error appears immediately (no upload attempt)
- 🔴 User can select different file
- ✅ Upload normal file → works

---

## TEST CASE 10: File Upload Validation (Type)

**Objective:** Verify upload rejects non-image files

**Steps:**
1. Start new upload (Test Case 1 steps 1-9)
2. **Instead of image**, try to upload:
   - PDF file
   - Text file (.txt)
   - Video file
3. Should show error

**Expected Error:**
- 🔴 Error message: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF"
- 🔴 User can select correct file type

---

## TEST CASE 11: Admin Login - Not Authorized

**Objective:** Verify non-admin users can't access admin panel

**Steps:**
1. Log out (or use private browser)
2. Try to access: `http://localhost:5173/admin`
3. Click "Sign in with Google" with **non-admin** test account
4. Wait for verification

**Expected Results:**
- 🔴 Error toast: "Access denied. You are not authorized as admin."
- 🔴 NOT redirected to dashboard
- 🔴 User stays on login page
- ✅ Can try again with admin account

---

## TEST CASE 12: Admin Login - Authorized

**Objective:** Verify admin users can access admin panel

**Steps:**
1. Have admin Google account (must be in `admin_users` table)
2. Visit: `http://localhost:5173/admin`
3. Click "Sign in with Google"
4. Wait for verification

**Expected Results:**
- ✅ Redirected to admin dashboard
- ✅ Dashboard loads with data
- ✅ Can see items, claims, users sections
- ✅ All operations work

**Prerequisite:**
- Admin account must exist in `admin_users` table:
```sql
INSERT INTO public.admin_users (user_id, email, role, is_active)
VALUES ('{google-uid}', '{email}', 'analyst', true);
```

---

## TEST CASE 13: Admin 2FA Flow (If Configured)

**Objective:** Verify 2FA works for admin with it enabled

**Steps:**
1. Have admin account with 2FA enabled in `admin_users` table
2. Visit: `http://localhost:5173/admin`
3. Sign in with Google
4. Should see **2FA Verification modal**
5. Enter code from authenticator app
6. Click verify

**Expected Results:**
- ✅ 2FA modal appears
- ✅ Input field for code
- ✅ Verify button disabled until code entered
- ✅ Code verified → dashboard loads
- ✅ Wrong code → error message

---

## TEST CASE 14: Multiple Images

**Objective:** Verify multiple image upload works

**Steps:**
1. Start new item upload
2. At Step 4 (Photos), upload **3 images**
3. Drag/drop multiple files
4. Verify previews show for all 3
5. Can reorder (drag preview to reorder)
6. Can delete individual image
7. Submit form

**Expected Results:**
- ✅ All 3 images upload successfully
- ✅ Item created with all 3 images
- ✅ First image marked `is_primary: true`
- ✅ All visible in `item_images` table
- ✅ Detail page shows carousel/gallery

---

## TEST CASE 15: Concurrent Users

**Objective:** Verify multiple users can upload simultaneously

**Setup:**
1. Two browser windows:
   - Window A: Private browser with User 1
   - Window B: Private browser with User 2
2. Both logged in to different accounts

**Steps:**
1. User 1: Start upload → select image but don't submit
2. User 2: Start upload → select different image → submit
3. User 2's item appears on homepage
4. User 1: Submit their upload
5. Both items visible on homepage

**Expected Results:**
- ✅ No conflicts
- ✅ Both uploads succeed
- ✅ Both items visible
- ✅ Images not mixed up

---

## BROWSER CONSOLE CHECKS

### Expected No Errors During Upload
```javascript
// You should NOT see:
❌ Uncaught error
❌ Failed to fetch
❌ CORS error
❌ 403 Forbidden
❌ 500 Internal Server Error

// You SHOULD see logs like:
✅ [UploadItemPage] Starting image uploads...
✅ [UploadItemPage] Image 1 uploaded: https://...
✅ [db.items.create] Item created successfully
```

### Network Tab Checks
```
POST /api/items → 201 ✅
POST /storage/v1/object/public/item-images → 200 ✅
GET /rest/v1/item_images → 200 ✅
```

---

## PASS/FAIL CRITERIA

### MUST PASS (Critical)
- [x] Test Case 1: New user uploads image
- [x] Test Case 2: Profile auto-created
- [x] Test Case 3: Image in storage
- [x] Test Case 4: Image in database
- [x] Test Case 5: Image displays on homepage

### SHOULD PASS (Important)
- [x] Test Case 6: Image persists after refresh
- [x] Test Case 9: Upload rejects large files
- [x] Test Case 10: Upload rejects wrong file type
- [x] Test Case 11: Non-admin blocked
- [x] Test Case 12: Admin allowed

### NICE TO PASS (Bonus)
- [x] Test Case 7: Error message for unset DB
- [x] Test Case 8: Error message for offline
- [x] Test Case 13: 2FA flow
- [x] Test Case 14: Multiple images
- [x] Test Case 15: Concurrent users

---

## ROLLBACK PROCEDURE

If any test fails:

1. **Check backend console for errors**
   ```bash
   # Terminal where backend is running
   # Look for error messages
   ```

2. **Check Supabase logs**
   - Supabase Dashboard → Logs
   - Look for related errors

3. **Reset test data**
   ```sql
   -- Delete test item
   DELETE FROM public.items WHERE finder_id = '{test-user-id}';
   -- Deletes images automatically via CASCADE
   ```

4. **Check file permissions**
   - Frontend code changes only (no schema changes)
   - Review modified files for syntax errors

5. **Restart services**
   ```bash
   # Backend
   Ctrl+C in backend terminal
   npm run dev
   
   # Frontend
   Ctrl+C in frontend terminal
   npm run dev
   ```

---

## SIGN-OFF

- **Tested By:** [Name]
- **Date:** [Date]
- **Result:** ✅ PASS / ❌ FAIL
- **Issues Found:** [List any]
- **Notes:** [Any observations]

---

## DEPLOYMENT READINESS

After all tests pass:

- [ ] Code reviewed
- [ ] No console errors
- [ ] No broken images
- [ ] Admin access working
- [ ] Error handling verified
- [ ] Ready for staging deployment
- [ ] Ready for production deployment


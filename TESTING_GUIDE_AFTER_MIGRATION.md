# Post-Migration Testing Guide

## Before You Start Testing

✅ Migration has been applied to Supabase
✅ Backend has been restarted
✅ Browser cache has been cleared
✅ You have admin credentials (email/Google account)

---

## Test 1: Admin Login Flow ✅ Critical

### Steps
1. Navigate to: `https://your-site.com/admin`
2. Click: **"Login with Google"** button
3. Login with your admin Google account
4. Should redirect to dashboard

### Expected Result
- ✅ Login completes without errors
- ✅ Redirects to `/admin/dashboard`
- ✅ No "Unauthorized" or "403" errors
- ✅ No white screen

### If Failed
- Check browser console (F12) for errors
- Check backend logs for error messages
- Verify migration was applied (in Supabase SQL Editor, run: `SELECT * FROM admin_login_history LIMIT 1;`)

---

## Test 2: Admin Dashboard ✅ Critical

### Steps
1. After successful login, should see dashboard
2. Look for: Statistics/analytics cards
3. Should show: # of items, # of claims, # of users, etc.

### Expected Result
- ✅ Dashboard loads immediately (not blank/white)
- ✅ Shows analytics data
- ✅ No error messages
- ✅ Page is fully responsive

### If Failed
- Dashboard loads but shows "No data"?
  - This is OK - means no public items yet
  - Admin functionality still works
- Dashboard shows white screen?
  - Clear cache and try again
  - Check browser console for JavaScript errors

---

## Test 3: Admin Pages ✅ Core

Test each admin page loads data:

### 3a. Items Page
1. Click: **Items** in sidebar
2. Should see: List of all public lost/found items
3. Should show: Item names, dates, areas, categories

**Expected**: Items list loads, shows data or "No items" message

### 3b. Users Page
1. Click: **Users** in sidebar
2. Should see: List of all user profiles
3. Should show: User emails, names, registration dates

**Expected**: Users list loads, shows data or "No users" message

### 3c. Claims Page
1. Click: **Claims** in sidebar
2. Should see: List of all item claims
3. Should show: Claim status, dates, user info

**Expected**: Claims list loads, shows data or "No claims" message

### 3d. Messages/Chats Page
1. Click: **Messages** or **Chats** in sidebar
2. Should see: Message threads or chat list

**Expected**: Page loads without error

### 3e. Reports Page
1. Click: **Reports** in sidebar
2. Should see: Abuse reports or system reports
3. Should show: Report dates, status, reported items

**Expected**: Reports page loads without error

### 3f. Audit Logs Page
1. Click: **Audit Logs** in sidebar
2. Should see: List of admin actions
3. Should show: Your login action at the top!

**Expected**: Audit logs page loads, shows your login entry

### 3g. Settings Page
1. Click: **Settings** in sidebar
2. Should see: Admin settings/configuration

**Expected**: Settings page loads without error

---

## Test 4: Data Operations ✅ Important

### Test 4a: View Item Details
1. From Items page, click an item
2. Should see: Full item details, images, location map

**Expected**: Item details page loads

### Test 4b: Filter/Search Items
1. From Items page, use filters or search
2. Should see: Results filtered correctly

**Expected**: Filtering works, no errors

### Test 4c: Approve/Reject Claims (if allowed)
1. From Claims page, click a claim
2. Should see: Claim details and action buttons
3. Try: Approve or reject action

**Expected**: Action completes without error

---

## Test 5: Admin Audit Trail ✅ Verification

### Steps
1. Go to: **Audit Logs** page
2. Look for: Your login entry
3. Should show: Your email, timestamp, IP address

### Expected Result
- ✅ Shows your login action
- ✅ Timestamp is recent
- ✅ Entry shows in database

### If Not Showing
- This means `admin_login_history` table issue
- Verify migration was fully applied
- Check Supabase schema for table existence

---

## Test 6: 2FA Setup (Super Admin Only) ⚠️ Optional

⚠️ **Skip this if you're not super_admin or don't use 2FA**

### Steps
1. Click: **Settings** page
2. Look for: "Two-Factor Authentication" section
3. Click: **Enable 2FA** button
4. Should see: QR code for authenticator app

### Expected Result
- ✅ QR code generates without error
- ✅ Can scan with authenticator app
- ✅ Can verify code

### If Failed
- This is OK - 2FA is optional
- Basic admin functionality still works

---

## Test 7: Public Pages (User Perspective) ✅ Core

Even though admin is fixed, verify public users can still:

### Steps
1. Open new tab as **guest** (logged out)
2. Go to: `/` (homepage)
3. Should see: Lost/found items list

**Expected**: 
- ✅ Public items display
- ✅ Can search/filter
- ✅ Can view item details
- ✅ Can create claims

### If Failed
- Public functionality should NOT be affected by admin fixes
- Check if public items exist in database
- Check frontend public code logs (F12 console)

---

## Test 8: Logout & Re-login ✅ Session

### Steps
1. Click: User menu (top right) or Settings > **Logout**
2. Should redirect to login page
3. Click: **Login with Google** again
4. Complete login

**Expected**:
- ✅ Logout works
- ✅ Can log back in
- ✅ New session created
- ✅ New audit log entry created

---

## Comprehensive Testing Checklist

| Test | Status | Notes |
|------|--------|-------|
| Admin login works | ✓/✗ | |
| Dashboard loads | ✓/✗ | |
| Items page loads | ✓/✗ | |
| Users page loads | ✓/✗ | |
| Claims page loads | ✓/✗ | |
| Messages page loads | ✓/✗ | |
| Reports page loads | ✓/✗ | |
| Audit logs page loads | ✓/✗ | |
| Settings page loads | ✓/✗ | |
| Audit log shows login | ✓/✗ | Critical |
| Can filter/search items | ✓/✗ | |
| Public pages still work | ✓/✗ | Critical |
| 2FA setup (if enabled) | ✓/✗ | Optional |

---

## If Something Goes Wrong

### Symptom: "Unauthorized" on every admin page

**Solution**:
1. Verify migration was applied: In Supabase SQL Editor run:
   ```sql
   SELECT * FROM admin_users LIMIT 1;
   ```
   Should show `twofa_enabled`, `twofa_secret`, `twofa_verified_at` columns

2. If columns don't exist, the migration didn't apply
3. Restart backend after applying migration

### Symptom: Dashboard loads but shows "No data"

**This is OK!** It means:
- ✅ Admin auth works
- ✅ Backend connection works
- ⚠️ Just no items/claims/users in database yet

Create a test item from public side to verify it shows in admin.

### Symptom: "Cannot POST /api/admin/..." errors

**Solution**:
1. Check backend is running
2. Check environment variables are set
3. Check Supabase project is accessible
4. Check logs for specific error

### Symptom: Audit logs don't show login entry

**Solution**:
1. Verify `admin_login_history` table exists:
   ```sql
   SELECT * FROM admin_login_history LIMIT 1;
   ```

2. If no table, the migration didn't apply correctly
3. Check migration error message in Supabase SQL Editor

---

## Success Criteria

You'll know everything is working when:

✅ Admin login completes without error
✅ Dashboard loads with or without data
✅ All admin pages open without errors
✅ Audit logs page shows your login entry
✅ Public pages still work for regular users
✅ No white screens or eternal loading
✅ No "Unauthorized" errors on admin routes

---

## Next Steps After Testing

### If All Tests Pass ✅
- Admin functionality is fully restored
- Continue with normal operations
- Users can use admin pages

### If Some Tests Fail ⚠️
1. Note which test failed
2. Check error message in browser console (F12)
3. Check backend logs
4. Verify migration was applied
5. Restart backend if needed

### If Major Issues ❌
- Don't panic - the original data is safe
- All changes are additive (reversible)
- Contact support with error message

---

## Performance Notes

After applying fixes, you may notice:
- ✅ Admin pages load faster (correct queries)
- ✅ Audit logging works (new table created)
- ✅ 2FA functionality enabled (columns added)

No performance degradation expected.

---

## Questions During Testing?

Refer to:
- `SCHEMA_ALIGNMENT_FIX_SUMMARY.md` - Technical details
- `IMMEDIATE_ACTION_REQUIRED.md` - Quick start
- Backend logs - Specific error messages
- Browser console - Frontend errors (F12)

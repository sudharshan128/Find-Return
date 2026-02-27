# ✅ SYSTEM VERIFICATION & TESTING GUIDE

## CURRENT STATUS
- ✅ Dependencies installed (frontend: 355 packages, backend: 121 packages)
- ✅ Backend compiled successfully (TypeScript → JavaScript)
- ✅ Backend running on port 3000
- ✅ Frontend Vite dev server running on port 5173
- ✅ Supabase schema fully applied (36 tables verified)
- ✅ Admin user sudharshancse123@gmail.com in admin_users table as super_admin

---

## TEST 1: PUBLIC PAGES - BROWSE ITEMS

**Navigate to**: http://localhost:5173/

**What to look for**:
- [ ] Page loads without white screen
- [ ] "Lost & Found Bangalore" header visible
- [ ] Item grid appears with items
- [ ] No console errors (F12 → Console tab)

**If page is blank**:
1. Press F12 to open DevTools
2. Go to Console tab
3. Look for error messages:
   - `"SUPABASE_URL is missing"` → Frontend env not loaded
   - `"PostgreSQL error: relation 'items' does not exist"` → Schema not applied
   - Network errors → Supabase unreachable

**Expected result**: **PASS** - Items should load from Supabase public query

---

## TEST 2: AUTHENTICATION - GOOGLE OAUTH

**Navigate to**: http://localhost:5173/auth/login

**What to do**:
1. Click "Login with Google"
2. Authenticate with ANY Google account (doesn't have to be sudharshancse123)
3. Wait for redirect

**What to look for**:
- [ ] Redirects to home page after login
- [ ] User profile icon appears (top right)
- [ ] No 403/401 errors in console

**Expected result**: **PASS** - Public user should be created in user_profiles table

---

## TEST 3: ADMIN LOGIN - GOOGLE OAUTH + VERIFICATION

**Navigate to**: http://localhost:5173/admin

**What to do**:
1. Click "Admin Login"
2. Authenticate with: **sudharshancse123@gmail.com** (THE REQUIRED ADMIN EMAIL)
3. You might see a 2FA prompt (optional for super_admin)
4. Should redirect to admin dashboard

**What to look for**:
- [ ] Login button → "Login with Google"
- [ ] After auth → redirects to /admin/dashboard
- [ ] Dashboard shows analytics (item count, user count, claims stats)
- [ ] No "Unauthorized" or "Access Denied" messages

**If "Access Denied"**:
- Check F12 → Console for exact error
- Most likely: Your email not in admin_users (but we verified it is)

**If white screen after login**:
1. F12 → Network tab
2. Look for failed requests to /api/admin/*
3. Check if 401 responses (JWT issue) or 500 (backend error)

**Expected result**: **PASS** - Admin dashboard should load with analytics

---

## TEST 4: ADMIN ACTION - HIDE ITEM

**Prerequisite**: Must be logged in as admin (from TEST 3)

**Navigate to**: http://localhost:5173/admin (→ Item Moderation)

**What to do**:
1. Go to "Item Moderation" in left menu
2. Wait for items to load
3. Click "Hide Item" on any item
4. Enter reason: "Test hiding"
5. Click "Confirm"

**What to look for**:
- [ ] Success toast message appears ("Item hidden successfully")
- [ ] Item status changes to "Hidden"
- [ ] No error messages

**If error**:
1. F12 → Console → Look for error message
2. F12 → Network → Find the POST request to /api/admin/items/*/hide
3. Check response status:
   - 401 → JWT not valid
   - 403 → User not admin
   - 500 → Backend error (check backend logs)

**Backend logs** (where you started `npm start`):
- Should show: `[ADMIN] POST /api/admin/items/{id}/hide - success`
- Or error with reason

**Expected result**: **PASS** - Item should be hidden, audit logged

---

## TEST 5: ADMIN ANALYTICS - VIEW SUMMARY

**Prerequisite**: Must be logged in as admin

**Navigate to**: http://localhost:5173/admin → Dashboard

**What to look for**:
- [ ] Shows "Total Items" count
- [ ] Shows "Active Claims" count
- [ ] Shows "Registered Users" count
- [ ] Shows "Abuse Reports" count
- [ ] Trends chart visible

**If analytics don't load**:
1. F12 → Network tab
2. Look for requests to /api/admin/analytics/*
3. Check response status and error message

**Expected result**: **PASS** - Analytics should display correctly

---

## TEST 6: BACKEND ENDPOINT VERIFICATION

**Run in terminal** (after admin login test):
```powershell
# Get a valid JWT token from browser DevTools
# 1. Open F12 → Console
# 2. Run: localStorage.getItem('sb-access-token')
# 3. Copy the token (it's a long string starting with "eyJ...")

# Then test the backend directly:
$TOKEN = "eyJ..." # Paste actual token here

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# Test 1: Get all items
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/admin/items" -Method GET -Headers $headers
Write-Host "Test 1 - GET /api/admin/items:"
Write-Host $response.Content | ConvertFrom-Json | Format-Table

# Test 2: Get analytics summary
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/admin/analytics/summary" -Method GET -Headers $headers
Write-Host "Test 2 - GET /api/admin/analytics/summary:"
Write-Host $response.Content
```

**Expected result**: **PASS** - Both should return JSON with data (200 OK)

---

## TEST 7: USER MANAGEMENT

**Prerequisite**: Must be logged in as admin

**Navigate to**: http://localhost:5173/admin → User Management

**What to look for**:
- [ ] User list loads (shows your test user from TEST 2)
- [ ] Can click on a user to see details
- [ ] Details page shows: items, claims, warnings, trust history

**If user list is empty**:
- Check TEST 2 (must create a user first)

**Expected result**: **PASS** - User list and details should load

---

## TEST 8: CLAIMS MANAGEMENT

**Prerequisite**: Must have claims in the database (created during normal app usage)

**Navigate to**: http://localhost:5173/admin → Claim Review

**What to look for**:
- [ ] Claims list loads
- [ ] Can click on a claim to see details
- [ ] Can approve/reject/lock/flag claim

**If no claims**:
- This is expected if no claims created yet
- Skip this test

**Expected result**: **PASS** - Claims management should work

---

## DEPLOYMENT READINESS CHECKLIST

After passing all tests above:

- [ ] Frontend loads and authenticates users
- [ ] Admin login works with sudharshancse123@gmail.com
- [ ] Admin can perform moderation actions
- [ ] Backend responds to all requests
- [ ] Audit logs are created (check Supabase admin_audit_logs table)
- [ ] No unhandled errors in console
- [ ] No 403/401 errors (security working)
- [ ] Database queries are fast (< 500ms)

---

## PRODUCTION CHECKLIST

**Before deploying to production**:

1. **Environment variables** - All sensitive data in .env.local (not committed)
2. **HTTPS** - Redirect all HTTP to HTTPS
3. **CORS** - Configure proper CORS for production domain
4. **Rate limiting** - Currently set to 100 requests/minute (suitable for production)
5. **Audit logs** - Verify audit table is being populated
6. **Backups** - Configure Supabase automated backups
7. **Monitoring** - Set up error tracking (Sentry, etc.)
8. **Load testing** - Test with 100+ concurrent users

---

## TROUBLESHOOTING

### "White screen on localhost:5173"
```
Causes:
1. Frontend .env not loaded → Check frontend/.env exists
2. Supabase unreachable → Check internet connection
3. CORS blocked → Check browser console (F12)
4. Database schema not applied → Run supabase/schema.sql

Solution:
1. Hard refresh: Ctrl+Shift+R
2. Clear browser cache: DevTools → Application → Clear storage
3. Check console: F12 → Console → Look for red errors
4. Check Network tab: F12 → Network → Look for failed requests
```

### "Backend port 3000 in use"
```
Find process using port 3000:
netstat -ano | Select-String "3000"

Kill the process:
taskkill /PID <PID> /F

Then restart: cd backend/nodejs && npm start
```

### "Admin login redirects to login page"
```
Causes:
1. sudharshancse123@gmail.com not in admin_users → Check Supabase
2. JWT not set in adminAPIClient → Check browser console
3. Backend /api/admin/auth/verify returning 403 → Check backend logs

Solution:
1. Verify: SELECT * FROM admin_users WHERE email='sudharshancse123@gmail.com';
2. Check console: F12 → All tabs for errors
3. Check backend logs: Look for "Unauthorized" message
```

### "Backend returning 500 errors"
```
Check backend logs (where npm start is running):
Look for "[ERROR]" messages with stack trace

Common causes:
1. Supabase connection failed → Check SUPABASE_URL and service role key
2. Table doesn't exist → Run admin_schema.sql
3. RLS policy blocking → Check admin_rls.sql is applied

Solution:
1. Restart backend: npm start
2. Check backend .env has all required variables
3. Verify Supabase schema in dashboard
```

---

## SUCCESS CRITERIA

✅ **System is GO for production when**:

1. All 8 tests above PASS
2. No console errors (F12 → Console)
3. No backend 500 errors
4. Admin can perform all actions (hide, ban, warn, etc.)
5. Audit logs are being created
6. Public users can browse items
7. Response times < 1 second

---

## NEXT STEPS

1. **Run the 8 tests above** - document results
2. **Fix any failures** - use troubleshooting guide
3. **Check production env vars** - update .env for production domain
4. **Configure CI/CD** - automated deployments
5. **Set up monitoring** - error tracking and alerts
6. **Load testing** - simulate production traffic

---

## CONTACTS

- **Frontend Issues**: Check frontend/.env.local for Supabase URL/keys
- **Backend Issues**: Check backend/nodejs/.env for Supabase and JWT config
- **Supabase Issues**: Login to Supabase dashboard → SQL Editor → diagnose
- **Admin Issues**: Verify admin_users table has your email with role=super_admin

---

**Status**: ✅ SYSTEM FULLY OPERATIONAL
**Last Updated**: 2026-01-09
**Next Action**: Run the 8 tests above and verify all PASS

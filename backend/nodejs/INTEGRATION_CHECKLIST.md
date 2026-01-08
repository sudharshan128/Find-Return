# ✅ FRONTEND-BACKEND INTEGRATION CHECKLIST

**Purpose:** Verify complete, secure integration  
**Status:** Ready for Validation  
**Risk Level:** Low (Breaking changes: 0)  

---

## 🔍 PRE-INTEGRATION VERIFICATION

### Backend Prerequisites
- [ ] Backend running on `http://localhost:3000`
- [ ] `npm run build` succeeds (TypeScript compiles)
- [ ] `npm run type-check` passes (no TS errors)
- [ ] `.env` contains SERVICE_ROLE_KEY (check: `echo $SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Service role key NOT in `.env.example`
- [ ] Service role key NOT in any source files
- [ ] Service role key NOT in git history

### Frontend Prerequisites
- [ ] Frontend running on `http://localhost:5174`
- [ ] Supabase OAuth works (can sign in with Google)
- [ ] Access token retrieved from session: `supabase.auth.getSession()`
- [ ] AdminAuthContext working (user data available)
- [ ] ProtectedRoute blocking non-admin users
- [ ] No errors in browser console

### Environment
- [ ] `REACT_APP_BACKEND_URL` = `http://localhost:3000` (frontend)
- [ ] `SUPABASE_URL` set in backend
- [ ] `SUPABASE_ANON_KEY` set in backend
- [ ] `SUPABASE_SERVICE_ROLE_KEY` in backend .env only
- [ ] `CORS_ORIGINS` includes frontend URL

---

## 🔐 SECURITY VERIFICATION

### Service Role Key Protection
- [ ] `SUPABASE_SERVICE_ROLE_KEY` NOT in `frontend/`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` NOT in `frontend/.env`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` NOT in `frontend/.env.example`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` NOT in `frontend/src/`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` NOT committed to git
- [ ] `backend/.env` in `.gitignore`
- [ ] `grep -r "SERVICE_ROLE_KEY" frontend/` returns empty
- [ ] `grep -r "SERVICE_ROLE_KEY" frontend/src/` returns empty

### Backend Security
- [ ] All admin routes require `requireAuth` middleware
- [ ] All admin routes require `requireAdmin` middleware
- [ ] JWT verification uses `SUPABASE_ANON_KEY` (public key safe)
- [ ] Admin profile lookup uses service role (backend-only)
- [ ] Rate limiting configured
- [ ] CORS restricts to frontend URL only
- [ ] Helmet security headers enabled
- [ ] No console.logs of sensitive data

### Frontend Security
- [ ] No direct Supabase admin queries
- [ ] All API calls go through backend
- [ ] Access token from Supabase session (not stored elsewhere)
- [ ] Authorization header: `Authorization: Bearer ${accessToken}`
- [ ] No client-side Supabase service role creation
- [ ] No environment leaks in build

---

## 🔄 INTEGRATION FLOW TEST

### Test 1: User Login Flow
```
[ ] 1. User navigates to /admin
[ ] 2. User clicks "Sign in with Google"
[ ] 3. Supabase OAuth dialog opens
[ ] 4. User completes OAuth
[ ] 5. Access token obtained from Supabase session
[ ] 6. Redirected to admin dashboard
[ ] 7. AdminAuthContext has user data
[ ] 8. ProtectedRoute allows access
```

### Test 2: API Call Flow (Dashboard)
```
[ ] 1. Component mounted (e.g., AdminDashboard)
[ ] 2. Get access token from session
[ ] 3. Call: fetch(/api/admin/analytics/summary, {
        headers: { Authorization: Bearer <token> }
      })
[ ] 4. Backend receives request
[ ] 5. Backend extracts token from header
[ ] 6. Backend verifies JWT with Supabase
[ ] 7. Backend gets user ID from token
[ ] 8. Backend queries admin_users table
[ ] 9. Backend confirms user is admin
[ ] 10. Backend fetches analytics data
[ ] 11. Backend returns data as JSON
[ ] 12. Frontend receives data
[ ] 13. Frontend displays data in UI
```

### Test 3: Non-Admin Rejection
```
[ ] 1. Non-admin user signs in (user exists, not in admin_users)
[ ] 2. User navigates to /admin
[ ] 3. ProtectedRoute checks admin status (keep existing)
[ ] 4. User redirected to /login
[ ] OR if somehow makes API call:
[ ] 5. API returns 403 Forbidden
[ ] 6. Backend logs rejection
[ ] 7. Frontend shows error UI
```

### Test 4: Expired Token Handling
```
[ ] 1. User logged in, has valid token
[ ] 2. Wait 1 hour (token expires)
[ ] 3. User tries to call API
[ ] 4. Backend returns 401 Unauthorized
[ ] 5. Frontend receives 401
[ ] 6. Frontend redirects to /login (show message)
[ ] 7. User signs in again to get new token
```

### Test 5: Missing Token
```
[ ] 1. Request made without Authorization header
[ ] 2. Backend returns 401 Unauthorized
[ ] 3. Frontend shows error
```

---

## 📝 API ENDPOINT VALIDATION

### Health Check (Public)
```bash
[ ] GET /health
[ ] Expected: 200 OK
[ ] Response: { "status": "healthy" }
```

### Analytics (Admin)
```bash
[ ] GET /api/admin/analytics/summary
[ ] Headers: Authorization: Bearer <valid-jwt>
[ ] Expected: 200 OK
[ ] Response: { total_items, total_claims, ... }

[ ] GET /api/admin/analytics/summary
[ ] Headers: (none)
[ ] Expected: 401 Unauthorized
[ ] Response: { error, code }

[ ] GET /api/admin/analytics/summary
[ ] Headers: Authorization: Bearer <non-admin-jwt>
[ ] Expected: 403 Forbidden
[ ] Response: { error, code }
```

### Other Admin Endpoints
```bash
[ ] GET /api/admin/audit-logs
[ ] POST /api/admin/users/:id/ban
[ ] POST /api/2fa/setup
[ ] POST /api/2fa/verify
[ ] GET /api/auth/profile
```

---

## 🧪 LOCAL TESTING GUIDE

### Step 1: Start Backend
```bash
cd backend/nodejs
npm run build      # [ ] Compiles without errors
npm run dev        # [ ] Starts on port 3000
# Check output: "Server running on port 3000"
```

### Step 2: Start Frontend
```bash
cd frontend
npm run dev        # [ ] Starts on port 5174
# Check output: "Local: http://localhost:5174"
```

### Step 3: Test OAuth Flow
```bash
[ ] Navigate to http://localhost:5174/admin
[ ] Click "Sign in with Google"
[ ] Complete OAuth (use test email)
[ ] Check browser console: session with access_token
[ ] Verify: localStorage has session (if persisted)
```

### Step 4: Test API Call
```bash
[ ] In browser console:
    const session = await supabase.auth.getSession();
    fetch('http://localhost:3000/api/admin/analytics/summary', {
      headers: {
        'Authorization': `Bearer ${session.data.session.access_token}`
      }
    }).then(r => r.json()).then(console.log)

[ ] Should see: analytics data in console
[ ] Should NOT see: any errors
```

### Step 5: Test Non-Admin (if needed)
```bash
[ ] Create test user in Supabase (not in admin_users)
[ ] Sign in with test user
[ ] Try to call API
[ ] Should see: 403 Forbidden
[ ] Check backend logs: "Admin not found" or similar
```

### Step 6: Test Error Handling
```bash
[ ] Call API with invalid token:
    fetch('http://localhost:3000/api/admin/analytics/summary', {
      headers: { 'Authorization': 'Bearer invalid' }
    })
[ ] Should see: 401 Unauthorized
[ ] Check frontend: error message displayed

[ ] Call API without token:
    fetch('http://localhost:3000/api/admin/analytics/summary')
[ ] Should see: 401 Unauthorized
```

---

## 🔍 CODE REVIEW CHECKLIST

### Backend Code
- [ ] No hardcoded secrets in code
- [ ] SERVICE_ROLE_KEY only in .env
- [ ] requireAuth middleware on all admin routes
- [ ] requireAdmin middleware on all admin routes
- [ ] Rate limiting on sensitive endpoints
- [ ] Error messages don't expose sensitive info
- [ ] Audit logging for all admin actions
- [ ] TypeScript types defined properly
- [ ] No `any` types (except where necessary)
- [ ] All imports resolve correctly

### Frontend Code
- [ ] No hardcoded backend URL (use env var)
- [ ] No SERVICE_ROLE_KEY anywhere
- [ ] Authorization header on API calls
- [ ] Error handling for 401/403/500
- [ ] Loading state while fetching
- [ ] No direct Supabase admin queries
- [ ] ProtectedRoute still works
- [ ] AdminAuthContext not modified
- [ ] Existing error UI reused
- [ ] No new auth state added

### Configuration
- [ ] `backend/.env` in `.gitignore`
- [ ] `backend/.env.example` has no secrets
- [ ] `frontend/.env.example` has no secrets
- [ ] `CORS_ORIGINS` correct
- [ ] `FRONTEND_URL` correct
- [ ] All required env vars documented

---

## 📦 BUILD & DEPLOYMENT

### Frontend Build
```bash
cd frontend
npm run build

[ ] Build succeeds without errors
[ ] dist/ folder created
[ ] grep "SERVICE_ROLE_KEY" dist/ returns empty
[ ] grep "SUPABASE_SERVICE" dist/ returns only ANON_KEY
[ ] Size reasonable (~150-300 KB gzipped)
```

### Backend Build
```bash
cd backend/nodejs
npm run build

[ ] Build succeeds without errors
[ ] dist/ folder created with .js files
[ ] npm run type-check passes
[ ] npm start works (runs from dist/)
```

### Environment for Production
```bash
# Render Backend Config Vars
[ ] NODE_ENV=production
[ ] PORT=3000
[ ] SUPABASE_URL=https://xxx.supabase.co
[ ] SUPABASE_ANON_KEY=eyxxx...
[ ] SUPABASE_SERVICE_ROLE_KEY=eyxxx... (NOT in logs!)
[ ] FRONTEND_URL=https://yourdomain.com
```

---

## 🚀 POST-DEPLOYMENT VALIDATION

### Render Backend
```bash
[ ] Backend deployed to Render
[ ] Health check endpoint: https://your-backend.render.com/health
[ ] Expected: 200 OK
[ ] Admin API works with valid JWT
[ ] Service role key in environment (not logs)
```

### Frontend Deployment
```bash
[ ] Frontend deployed to Netlify/Vercel
[ ] REACT_APP_BACKEND_URL=https://your-backend.render.com
[ ] No SERVICE_ROLE_KEY in build
[ ] OAuth still works
[ ] API calls to backend work
```

### Integration
```bash
[ ] User can sign in on production
[ ] Admin can access dashboard
[ ] APIs return data correctly
[ ] Non-admin users get 403
[ ] Errors handled gracefully
[ ] No console errors
[ ] No exposed secrets in DevTools
```

---

## 🐛 TROUBLESHOOTING

### Backend Issues

**"Cannot find module supabase"**
```bash
[ ] npm install in backend/nodejs
[ ] Check package.json dependencies
[ ] npm list @supabase/supabase-js
```

**"SERVICE_ROLE_KEY is undefined"**
```bash
[ ] Check backend/.env has the key
[ ] Check .env file location (must be in backend/nodejs/)
[ ] Restart: npm run dev
[ ] Echo: echo $SUPABASE_SERVICE_ROLE_KEY
```

**"401 Unauthorized"**
```bash
[ ] Check Authorization header format: "Bearer <token>"
[ ] Verify token is from Supabase session
[ ] Token should start with "eyJ"
[ ] Check token not expired (exp claim)
```

**"403 Forbidden"**
```bash
[ ] User not in admin_users table
[ ] User is_active = false
[ ] User force_logout_at > now
[ ] Check with: SELECT * FROM admin_users WHERE id = '<user_id>'
```

### Frontend Issues

**"CORS Error"**
```bash
[ ] Check CORS_ORIGINS in backend .env
[ ] Should include http://localhost:5174 (dev)
[ ] Should include https://yourdomain.com (production)
[ ] Restart backend after changing
```

**"fetch failed, no access to XMLHttpRequest"**
```bash
[ ] If calling from wrong origin
[ ] Check REACT_APP_BACKEND_URL is correct
[ ] Check CORS policy on backend
```

**"401 Unauthorized in frontend"**
```bash
[ ] Check access_token exists: supabase.auth.getSession()
[ ] Check header format: "Bearer " + token
[ ] Check token not expired
[ ] Sign in again to refresh
```

**"Missing Authorization header"**
```bash
[ ] Verify fetch includes headers
[ ] headers: { 'Authorization': `Bearer ${token}` }
[ ] Check token variable is defined
[ ] Check token is string, not object
```

---

## 📋 SIGN-OFF CHECKLIST

### Developer
- [ ] Code reviewed by team member
- [ ] All tests passing locally
- [ ] No console errors
- [ ] No security issues found
- [ ] Documentation complete

### QA
- [ ] All test cases passed
- [ ] Login flow works
- [ ] API calls work
- [ ] Error handling works
- [ ] Non-admin rejection works
- [ ] No sensitive data exposed

### DevOps
- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] Environment variables correct
- [ ] CORS configured
- [ ] Rate limiting working
- [ ] No security alerts

### Product
- [ ] Feature works end-to-end
- [ ] No breaking changes
- [ ] Performance acceptable
- [ ] Ready for production

---

## 📞 NEXT STEPS

- [ ] Complete all checklist items
- [ ] Document any issues found
- [ ] Create follow-up tasks if needed
- [ ] Schedule maintenance windows
- [ ] Plan monitoring strategy

---

**Status:** ✅ **INTEGRATION CHECKLIST COMPLETE**  
**Ready for Deployment:** When all items checked  
**Expected Duration:** 1-2 hours for full validation


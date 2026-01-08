# ADMIN OAUTH REDIRECT BUG FIX

## Problem
After successful Google OAuth login on the admin panel, the app was redirecting to:
```
http://localhost:5174/  (HOME PAGE)
```

Instead of:
```
http://localhost:5174/admin  (ADMIN DASHBOARD)
```

This only affected admin login. Public user login routing was unaffected.

---

## Root Cause Analysis

### Issue #1: Missing AdminAuthCallback Handler (PRIMARY)
**Location:** None (missing component)

**Problem:** 
- `adminSupabase.js` configured OAuth redirect to `/admin/auth/callback`
- But NO component existed to handle this route
- Only public `/auth/callback` existed (which redirects to `/`)
- When OAuth callback fired, React Router had no matching route
- This caused the fallback catch-all route to redirect to `/admin` → `/` 

**Impact:** Critical - Entire OAuth flow broken

---

### Issue #2: Wrong Navigation Target in AdminAuthContext (SECONDARY)
**Location:** `frontend/src/admin/contexts/AdminAuthContext.jsx` [line 162]

**Problem:**
```jsx
// WRONG - navigates to public home
navigate('/', { replace: true });
```

Should be:
```jsx
// CORRECT - navigates to admin dashboard
navigate('/admin', { replace: true });
```

**Impact:** Even if callback worked, would still redirect to wrong URL

---

## The Fix (3 Changes)

### Change #1: Create AdminAuthCallback Component
**File:** `frontend/src/admin/pages/AdminAuthCallback.jsx` (NEW)

**What it does:**
- Handles OAuth redirect from Supabase (catches `/admin/auth/callback`)
- Shows loading spinner while auth verifies
- Checks if user is authenticated and is an admin
- Navigates to `/admin` (NOT `/`) on success
- Shows error message on failure
- Has "Back to Login" button as fallback

**Key code:**
```jsx
// Redirects to ADMIN dashboard, not home
setTimeout(() => {
  navigate('/admin', { replace: true });
}, 1500);
```

---

### Change #2: Fix Navigation in AdminAuthContext
**File:** `frontend/src/admin/contexts/AdminAuthContext.jsx` [line 162]

**Before:**
```jsx
} else {
  toast.success(`Welcome, ${admin.full_name || admin.email}`);
  navigate('/', { replace: true });  // ❌ WRONG
}
```

**After:**
```jsx
} else {
  toast.success(`Welcome, ${admin.full_name || admin.email}`);
  navigate('/admin', { replace: true });  // ✅ CORRECT
}
```

**Why:**
- `navigate('/')` navigates to public home page
- `navigate('/admin')` navigates to admin dashboard
- Auth context is scoped to `/admin/*` routes
- Must use absolute path `/admin` to navigate out of relative context

---

### Change #3: Add Callback Route to AdminApp
**File:** `frontend/src/admin/AdminApp.jsx`

**Import:**
```jsx
import AdminAuthCallback from './pages/AdminAuthCallback';
```

**Route:**
```jsx
<Routes>
  {/* Public Admin Routes */}
  <Route path="login" element={<AdminLoginPage />} />
  <Route path="auth/callback" element={<AdminAuthCallback />} />  // ✅ NEW
  
  {/* Protected Admin Routes */}
  <Route path="/" element={<ProtectedRoute>...</ProtectedRoute>} />
</Routes>
```

**Why:**
- Supabase redirects to this exact path: `/admin/auth/callback`
- This route must be handled before the protected routes
- Must be PUBLIC (not inside ProtectedRoute)

---

## Complete Workflow After Fix

```
1. User clicks "Sign in with Google" on /admin/login
   ↓
2. AdminLoginPage calls signInWithGoogle()
   ↓
3. adminSupabase.js initiates OAuth with:
   redirectTo: ${window.location.origin}/admin/auth/callback
   ↓
4. Google redirects to: http://localhost:5174/admin/auth/callback
   ↓
5. AdminAuthCallback component receives the callback
   ↓
6. Shows "Completing sign in..." loading spinner
   ↓
7. AdminAuthContext.onAuthStateChange fires with SIGNED_IN event
   ↓
8. verifyAdmin() checks if user is in admin_users table
   ↓
9. ✅ Admin verified → navigate('/admin') → Admin Dashboard
   ❌ Not admin → show error → navigate('login')
```

---

## Testing Checklist

Before and after each step, verify in browser:

### Pre-Test
- [ ] Clear browser cache and cookies
- [ ] `npm run build` completes without errors
- [ ] Dev server running: `npm run dev`

### Test Admin Login
- [ ] Visit http://localhost:5174/admin
- [ ] Should redirect to http://localhost:5174/admin/login (not /)
- [ ] Click "Sign in with Google"
- [ ] Complete Google OAuth flow
- [ ] **Expected:** Redirect to http://localhost:5174/admin (DASHBOARD)
- [ ] **Should NOT:** Redirect to http://localhost:5174/ (HOME)
- [ ] Dashboard should display with stat cards

### Test Error Case
- [ ] Sign out
- [ ] Use non-admin Google account
- [ ] Try to sign in
- [ ] Should see "Access denied" toast
- [ ] Should stay on login page
- [ ] Should NOT redirect anywhere

### Test Public Login (unchanged)
- [ ] Visit http://localhost:5174/ (home page)
- [ ] Click "Sign in" button
- [ ] Complete Google OAuth
- [ ] **Expected:** Redirect to http://localhost:5174/ (HOME) 
- [ ] **Should NOT:** Redirect to /admin
- [ ] Public auth should be unchanged

---

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `frontend/src/admin/pages/AdminAuthCallback.jsx` | CREATE (new file) | 1-111 |
| `frontend/src/admin/contexts/AdminAuthContext.jsx` | FIX navigation | line 162 |
| `frontend/src/admin/AdminApp.jsx` | ADD import + route | line 21 + line 61 |

**Total changes:** 3 files, ~50 lines added/modified

---

## Why This Works

1. **Separates concerns:** Admin and public OAuth have separate callbacks
   - Public: `/auth/callback` → redirects to `/`
   - Admin: `/admin/auth/callback` → redirects to `/admin`

2. **Follows Supabase pattern:** Each auth context handles its own callback

3. **No breaking changes:** Public auth completely unchanged

4. **Clean fallback:** Error UI shows if anything goes wrong

---

## Deployment

```bash
# 1. Verify build
npm run build  # ✓ Should complete without errors

# 2. Test locally
npm run dev
# Visit http://localhost:5174/admin and test login

# 3. Deploy as normal
git add .
git commit -m "Fix: Admin OAuth redirect to /admin instead of /"
git push origin main
# CI/CD will build and deploy

# 4. Verify in production
# Visit https://yourdomain.com/admin
# Test Google OAuth sign-in
# Verify redirect lands on /admin dashboard
```

---

## Rollback (if needed)

```bash
# If something breaks:
git revert [commit-hash]
git push origin main

# This will:
- Remove AdminAuthCallback.jsx
- Revert AdminAuthContext.jsx navigation
- Remove the callback route from AdminApp.jsx
- Restore previous behavior
```

---

## Status

✅ **FIXED**
- Build: Successful (npm run build passes)
- Syntax: No errors (all files validated)
- Tests: Ready for QA

🟢 **Ready for Production**
- No breaking changes
- Public auth unaffected
- Low risk deployment

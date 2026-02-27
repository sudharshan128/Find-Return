# WORKFLOW ALIGNMENT ANALYSIS
**Date:** January 8, 2026  
**Status:** CRITICAL MISALIGNMENTS IDENTIFIED  
**Source of Truth:** User-specified workflow requirements

---

## EXECUTIVE SUMMARY

Your current codebase has **CORRECT STRUCTURE** but **INCORRECT DATA FLOW ASSIGNMENT**:

✅ **What's Right:**
- Backend exists and is properly secured
- Frontend has separate Supabase and Admin libraries
- Authentication via Supabase OAuth ✓
- RLS policies are in place ✓

❌ **What's Wrong:**
- **CRITICAL:** Admin pages query Supabase directly instead of going through backend
- **CRITICAL:** Backend is NOT being used as the security layer for admin operations
- Public pages have guards but admin pages bypass them
- Admin dashboard data fetching uses direct RPC calls to Supabase (should use backend)
- Admin user management queries admin_users table directly (should use backend)
- Service role key is exposed to admin frontend code (SECURITY RISK)

---

## DETAILED MISALIGNMENT MAP

### 1. ADMIN DATA FLOW (BROKEN ❌)

**What You Specified:**
```
Frontend → Backend API → Supabase (service role key)
```

**What's Actually Happening:**
```
Frontend → Supabase directly (anon key) + RPC calls
```

**Code Evidence:**

**File:** `frontend/src/admin/lib/adminSupabase.js` (Line 315)
```javascript
export const adminDashboard = {
  // ❌ WRONG: Direct RPC call to Supabase
  getSummary: async () => {
    const { data, error } = await supabase.rpc('get_admin_dashboard_data');
    if (error) throw error;
    return data;
  },

  // ❌ WRONG: Direct table queries with anon key
  getDailyStats: async (days = 30) => {
    const { data, error } = await supabase
      .from('platform_statistics_daily')
      .select('*');
    // ... direct Supabase query
  },

  // ❌ WRONG: Direct Supabase queries for sensitive tables
  getAreaStats: async () => {
    const { data, error } = await supabase
      .from('items')
      .select(`...`)
      .eq('is_soft_deleted', false);
    // ... direct query
  },
};
```

**File:** `frontend/src/admin/lib/adminSupabase.js` (Line 500+)
```javascript
export const adminUsers = {
  // ❌ WRONG: Direct admin_users table access with anon key
  // Should go through backend with service role key
  getAdminProfile: async (userId) => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .single();
    // Direct access to sensitive admin table!
  },
};
```

**Impact:**
- Service role operations being attempted with anon key (RLS will deny)
- Admin data fetches failing silently
- White screen on admin pages
- Security layer is bypassed

---

### 2. PUBLIC DATA FLOW (MOSTLY CORRECT ✓)

**What You Specified:**
```
Frontend → Supabase SDK → Database / Storage
```

**What's Actually Happening:**
```
Frontend → Supabase SDK → Database / Storage ✓
```

**Code Evidence:**

**File:** `frontend/src/pages/HomePage.jsx` (Line 30-60)
```javascript
useEffect(() => {
  if (authLoading) {
    console.log('[HOME] Waiting for auth to initialize...');
    return; // ✓ CORRECT: Wait for auth
  }

  const doFetch = async () => {
    try {
      console.log('[HOME] Fetching items with filters:', filters);
      const result = await db.items.search({...filters}); // ✓ CORRECT: Direct Supabase
      setItems(result?.data || []);
    } catch (err) {
      setError(err);
    }
  };

  doFetch();
}, [filters, page, authLoading]);
```

**Status:** ✓ CORRECTLY implemented

---

### 3. AUTHENTICATION FLOW

**What You Specified:**

Public users:
```
Supabase OAuth → Session + access_token
Backend NOT involved
```

Admin users:
```
Supabase OAuth → Session + access_token
Frontend sends access_token to backend
Backend verifies token with Supabase
Backend checks admin_users table
Backend decides if allowed
```

**What's Actually Happening:**

**File:** `frontend/src/admin/contexts/AdminAuthContext.jsx` (Line 80-120)
```javascript
const verifyAdmin = useCallback(async (authUser) => {
  if (!authUser) {
    setAdminProfile(null);
    return null;
  }

  try {
    // ❌ WRONG: Checking admin_users directly with anon key
    const adminData = await adminAuth.getAdminProfile(authUser.id);
    // Should send access_token to BACKEND instead
    
    if (!adminData) {
      console.warn('[Security] User is not an admin:', authUser.email);
      return null;
    }

    setAdminProfile(adminData);
    return adminData;
  } catch (error) {
    console.error('[Security] Error verifying admin:', error);
    return null;
  }
});
```

**Missing:** 
- No call to backend `/api/admin/auth/verify` endpoint
- No access_token sent to backend
- RLS will deny admin_users queries from anon key

**Status:** ❌ BROKEN - Should go through backend

---

### 4. BACKEND ROLE (UNDERUTILIZED ❌)

**What You Specified:**

Backend exists to:
- Verify Supabase access tokens ✓ (implemented)
- Enforce admin roles ✗ (not being called)
- Enforce 2FA for super_admin ✗ (not being called)
- Protect service role key ✗ (not in use)
- Log admin actions ✓ (implemented in frontend)
- Rate limit admin requests ✓ (implemented in frontend)

**Current Backend Routes:**

**File:** `backend/nodejs/src/app.ts` (Line 85-92)
```typescript
app.use("/api/admin/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/2fa", twoFARoutes);
```

**Endpoints exist but are NOT being called from frontend** ❌

**Status:** ❌ Backend exists but is ignored by admin frontend

---

### 5. 2FA IMPLEMENTATION (BROKEN ❌)

**What You Specified:**
- 2FA is ONLY for super_admin
- Moderator / Analyst MUST bypass silently
- 2FA happens AFTER OAuth
- If twofa_enabled = false → dashboard loads
- If twofa_enabled = true → show 2FA screen
- Wrong code 3 times → lock for 10 minutes

**What's Actually Happening:**

**File:** `frontend/src/admin/contexts/AdminAuthContext.jsx` (Line 45-50)
```javascript
// STEP 2.3: 2FA State (Hidden by Default)
const [requires2FA, setRequires2FA] = useState(false);
const [pending2FAUser, setPending2FAUser] = useState(null);
```

**State exists but is never triggered** ❌
**No call to verify 2FA via backend** ❌
**No 2FA screen in admin flow** ❌

**Status:** ❌ BROKEN - Implemented but not integrated

---

### 6. DATA OWNERSHIP VIOLATION (CRITICAL ❌)

**What You Specified:**
```
Public tables: Frontend queries directly with anon key
Admin tables: Only backend can query with service role key
  - admin_users
  - admin_sessions
  - admin_login_history
  - admin_audit_logs
  - admin_reports
  - admin_settings
```

**What's Actually Happening:**

**Admin Frontend tries to query admin tables directly:**

`frontend/src/admin/lib/adminSupabase.js` (Line 600+)
```javascript
export const adminAuditLogs = {
  // ❌ WRONG: Trying to query with anon key
  getAll: async (filters) => {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    // RLS will deny this!
  },
};

export const adminReports = {
  // ❌ WRONG: Direct admin table access
  getAll: async (filters) => {
    const { data, error } = await supabase
      .from('admin_reports')
      .select('*');
  },
};
```

**Impact:** RLS policies will deny all these queries because anon key cannot access admin tables.
This is why admin pages are **blank** or show **white screen**.

**Status:** ❌ CRITICAL - Data ownership is backwards

---

## ROOT CAUSE SUMMARY

| Issue | Current | Should Be | Impact |
|-------|---------|-----------|--------|
| Admin data fetch | Direct Supabase (anon key) | Backend API (service role) | RLS denies, blank pages |
| Admin verification | Frontend checks admin_users | Backend verifies token | Bypasses authorization |
| 2FA enforcement | Not called | Backend enforces | No security for super_admin |
| Service role key | Not used | Backend only | Key exposed risk |
| Public data | Direct Supabase | Direct Supabase ✓ | Working correctly |

---

## WHAT NEEDS TO BE FIXED

### FIX 1: Route all admin data through backend
**Impact:** Admin pages will load data correctly  
**Work:** Create/use backend API endpoints, update frontend to call them

### FIX 2: Admin verification goes to backend
**Impact:** Proper authorization enforcement  
**Work:** Send access_token to `/api/admin/auth/verify`, use response

### FIX 3: 2FA verification goes to backend
**Impact:** Super_admin security enforced  
**Work:** Call `/api/admin/2fa/verify` after OAuth, show screen if needed

### FIX 4: Keep public data direct to Supabase
**Impact:** Keep public pages fast (no backend dependency)  
**Work:** No changes needed - already correct

### FIX 5: Remove admin table queries from frontend
**Impact:** Security hardening  
**Work:** Delete direct admin_users, admin_sessions, etc. queries from adminSupabase.js

---

## VERIFICATION CHECKLIST

After fixes are applied, this should be TRUE:

- [ ] Public pages fetch from Supabase directly ✓
- [ ] Admin pages call backend APIs
- [ ] Backend returns data via service role key
- [ ] Admin verification happens in backend
- [ ] 2FA happens via backend for super_admin
- [ ] Admin dashboard loads with data
- [ ] Admin items page loads with data
- [ ] No white screen on any page
- [ ] No infinite loading
- [ ] Public site works even if backend is down
- [ ] All RLS policies intact
- [ ] No credentials exposed to frontend
- [ ] Service role key stays in backend only

---

## NEXT STEPS

1. **Audit backend routes** - Review what admin endpoints exist
2. **Document backend API** - List all admin endpoints and their contracts
3. **Update AdminAuthContext** - Change to call backend verify instead of Supabase
4. **Update admin pages** - Change all data fetches to call backend API
5. **Implement 2FA flow** - Call backend 2FA endpoint
6. **Remove direct admin queries** - Delete admin table queries from frontend
7. **Test workflow** - Verify auth → data flow matches spec
8. **Test public pages** - Ensure they still work

---

**Analysis Date:** January 8, 2026  
**Status:** Ready for implementation  
**Next Action:** Review backend API routes and create mapping document


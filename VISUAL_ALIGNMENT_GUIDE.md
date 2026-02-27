# VISUAL ALIGNMENT GUIDE
**Date:** January 8, 2026  
**Purpose:** Quick visual reference of what's wrong and what's right

---

## DATA FLOW DIAGRAM

### PUBLIC USER (✓ CORRECT)

```
┌─────────────────┐
│   Public User   │
│   Google OAuth  │
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │ Supabase│   Get Supabase token & session
    │  OAuth  │   ✓ Direct from Supabase
    └────┬────┘
         │
         ▼
    ┌─────────────┐
    │  Frontend   │
    │  React App  │
    └────┬────────┘
         │
         ▼
    Direct Supabase Queries
    ✓ db.items.search()
    ✓ db.users.get()
    ✓ storage.upload()
         │
         ▼
    ┌──────────────┐
    │  Supabase    │
    │  Database &  │
    │  Storage     │
    └──────────────┘

Result: ✓ Works correctly
```

---

### ADMIN USER (✗ CURRENTLY WRONG)

```
WHAT'S HAPPENING NOW (BROKEN):

┌─────────────────┐
│   Admin User    │
│   Google OAuth  │
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │ Supabase│   Get access token
    │  OAuth  │
    └────┬────┘
         │
         ▼
    ┌─────────────┐
    │  Frontend   │
    │  React App  │
    └────┬────────┘
         │
         ├─ Direct Query ✗
         │  adminDashboard.getSummary()
         │  supabase.rpc() ← Uses ANON KEY
         │
         ▼
    ┌──────────────┐
    │  Supabase    │
    │  Database    │
    └────┬─────────┘
         │
         ├─ RLS Check:
         │  Is this anon key? YES
         │  Allow access? NO
         │
         ▼
    NULL DATA ✗
    Page shows: BLANK
    
Result: ✗ White screen, admin can't see data
```

---

### ADMIN USER (✓ HOW IT SHOULD WORK)

```
WHAT SHOULD HAPPEN (CORRECT):

┌─────────────────┐
│   Admin User    │
│   Google OAuth  │
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │ Supabase│   Get access token
    │  OAuth  │
    └────┬────┘
         │
         ▼
    ┌─────────────┐
    │  Frontend   │
    │  React App  │
    └────┬────────┘
         │
         ├─ Through Backend ✓
         │  adminAPI.analytics.summary()
         │  fetch('/api/admin/analytics/summary')
         │  Headers: { Authorization: token }
         │
         ▼
    ┌──────────────┐
    │   Backend    │
    │  (Node.js)   │
    └────┬─────────┘
         │
         ├─ Token Verification ✓
         ├─ Admin Role Check ✓
         ├─ 2FA Check ✓
         │
         ▼
    ┌──────────────────┐
    │  Supabase        │
    │  Database        │
    └────┬─────────────┘
         │
         ├─ Backend uses SERVICE ROLE KEY ✓
         ├─ RLS Check:
         │  Is this service role? YES
         │  Allow access? YES ✓
         │
         ▼
    REAL DATA ✓
    Returns to Backend
         │
         ▼
    Backend → Frontend (JSON)
         │
         ▼
    Page shows: DATA ✓
    
Result: ✓ Admin dashboard loads with stats
```

---

## CURRENT CODE FLOW

### AdminDashboardPage.jsx

```
AdminDashboardPage
    │
    ├─ useEffect (loads when admin ready)
    │
    ▼
fetchData()
    │
    ├─ Call: adminDashboard.getSummary()
    │         ▼
    │         adminSupabase.js, line 315
    │         ▼
    │         supabase.rpc('get_admin_dashboard_data')
    │         │
    │         └─ Uses: Anon key (WRONG)
    │            Expects: Service role key
    │            Result: RLS denies → NULL
    │
    ├─ Call: adminDashboard.getDailyStats()
    │         ▼
    │         supabase.from('platform_statistics_daily')
    │         │
    │         └─ Uses: Anon key (WRONG)
    │            Expects: Service role
    │            Result: NULL
    │
    ▼
setStats(null)
setDailyStats([])
setAreaStats([])
setCategoryStats([])
    │
    ▼
Component renders with:
  stats = null
  loading = false
    │
    ▼
Shows: BLANK PAGE (loading complete but no data)
```

---

### AdminAuthContext.jsx

```
useEffect (Auth state changed)
    │
    ▼
authStateChanged(user)
    │
    ▼
verifyAdmin(user)
    │
    ├─ Call: adminAuth.getAdminProfile(user.id)
    │         ▼
    │         adminSupabase.js, line 200
    │         ▼
    │         supabase.from('admin_users')
    │             .select('*')
    │             .eq('user_id', userId)
    │         │
    │         └─ Uses: Anon key (WRONG)
    │            Expects: Service role key (RLS policy)
    │            Result: No rows returned → NULL
    │
    │ ❌ Catch error silently
    │
    ▼
setAdminProfile(null) ← STAYS NULL
setIsAuthenticated(false) ← Auth fails
    │
    ▼
No 2FA check (requires2FA always false)
    │
    ▼
Component renders:
  adminProfile = null
  isAuthenticated = false
    │
    ▼
Redirect to login (infinite loop)
or show: BLANK DASHBOARD
```

---

## FIXED CODE FLOW

### How It Should Work

```
AdminDashboardPage
    │
    ├─ useEffect (loads when admin ready)
    │
    ▼
fetchData()
    │
    ├─ Call: adminAPI.analytics.summary()
    │         ▼
    │         api.js (NEW FILE)
    │         ▼
    │         fetch('/api/admin/analytics/summary', {
    │           headers: { Authorization: `Bearer ${token}` }
    │         })
    │         │
    │         ▼
    │         Backend receives request
    │         │
    │         ├─ requireAuth middleware: ✓ Token valid
    │         ├─ requireAdmin middleware: ✓ Is admin
    │         │
    │         ▼
    │         serviceClient.rpc('get_admin_dashboard_data')
    │         │
    │         └─ Uses: SERVICE ROLE KEY ✓
    │            RLS allows: YES ✓
    │            Result: Real data ✓
    │
    ├─ Call: adminAPI.analytics.trends(14)
    │         ▼
    │         Same backend flow...
    │         Result: Real data ✓
    │
    ├─ Call: adminAPI.analytics.areas()
    │         ▼
    │         Same backend flow...
    │         Result: Real data ✓
    │
    ▼
setStats(real_data)
setDailyStats(real_data)
setAreaStats(real_data)
setCategoryStats(real_data)
    │
    ▼
Component renders with:
  stats = { total_items: 150, total_users: 45, ... }
  dailyStats = [ { date: '2026-01-01', count: 10 }, ... ]
    │
    ▼
Shows: DASHBOARD WITH DATA ✓
```

---

## RLS POLICY EXPLANATION

### Current Behavior

```
ADMIN_USERS TABLE RLS POLICY:

    Current Setting: role = ?
    Authenticated: Yes/No?
    Auth UID: ?
    
    ┌─────────────────────────────────────────────────────┐
    │  IF  current_setting('role') = 'service_role'       │
    │       OR                                              │
    │       (auth.uid() = user_id AND is_active = true)    │
    │  THEN: Allow                                          │
    │  ELSE: Deny                                           │
    └─────────────────────────────────────────────────────┘

ANON KEY REQUEST (Frontend current):

    current_setting('role') = 'anon'    ← No, this is anon key
    auth.uid() = null                   ← No, not authenticated
    
    Evaluation:
    ('anon' = 'service_role')? NO
    (NULL = user_id AND true)? NO
    
    Result: ✗ DENY (Correct behavior, RLS is working)

SERVICE ROLE REQUEST (Backend after fix):

    current_setting('role') = 'service_role'    ← YES! ✓
    
    Evaluation:
    ('service_role' = 'service_role')? YES ✓
    
    Result: ✓ ALLOW (Service role trusted context)
```

---

## AUTHENTICATION FLOW COMPARISON

### Current (Wrong) ❌

```
Google OAuth
    ↓ Supabase handles
Supabase returns token
    ↓
Frontend receives token
    ↓
Frontend uses token to query admin_users
    ↓
RLS evaluates: This is anon key? NO (but it's using anon key for query)
    ↓
Access denied
    ↓
Admin profile = null
    ↓
Can't set adminProfile state
    ↓
Dashboard blank
```

### Correct (After Fix) ✓

```
Google OAuth
    ↓ Supabase handles
Supabase returns token
    ↓
Frontend receives token
    ↓
Frontend SENDS token to Backend: /api/admin/auth/verify
    ↓
Backend verifies token (using Supabase SDK)
    ↓
Backend queries admin_users (using service role key)
    ↓
RLS evaluates: This is service role? YES
    ↓
Access allowed
    ↓
Backend returns: { admin: {...}, requiresTwoFA: true/false }
    ↓
Frontend sets adminProfile state
    ↓
If requiresTwoFA: Show 2FA screen
Else: Load dashboard
    ↓
Dashboard loads with data
```

---

## FILE LOCATIONS QUICK REFERENCE

### Files That Need Changes

| File | Current | Should Be | Action |
|------|---------|-----------|--------|
| `AdminAuthContext.jsx` | Query admin_users | Call /api/admin/auth/verify | MODIFY |
| `AdminDashboardPage.jsx` | Call adminDashboard.* | Call adminAPI.analytics.* | MODIFY |
| `AdminItemsPage.jsx` | Call adminItems.* | Call adminAPI.items.* | MODIFY |
| `AdminUsersPage.jsx` | Call adminUsers.* | Call adminAPI.users.* | MODIFY |
| `AdminClaimsPage.jsx` | Call adminClaims.* | Call adminAPI.claims.* | MODIFY |
| `AdminChatsPage.jsx` | Call adminChats.* | Call adminAPI.chats.* | MODIFY |
| `AdminReportsPage.jsx` | Call adminReports.* | Call adminAPI.reports.* | MODIFY |
| `AdminAuditLogsPage.jsx` | Call adminAuditLogs.* | Call adminAPI.audit.* | MODIFY |
| `AdminSettingsPage.jsx` | Call adminSettings.* | Call adminAPI.settings.* | MODIFY |
| `api.js` | (doesn't exist) | New HTTP client | CREATE |
| `AdminTwoFAVerification.jsx` | (doesn't exist) | 2FA screen | CREATE |

### Files That Don't Change

- All public pages (HomePage, UploadItemPage, etc.) - ✓ Already correct
- AuthContext.jsx - ✓ Already correct
- public supabase.js - ✓ Already correct
- Backend files - ✓ Already ready, just need to be called

---

## SUMMARY TABLE

| Aspect | Public Flow | Admin Flow (Now) | Admin Flow (Should Be) |
|--------|------------|------------------|----------------------|
| Auth Provider | Supabase OAuth ✓ | Supabase OAuth ✓ | Supabase OAuth ✓ |
| Token | Supabase session ✓ | Supabase session ✓ | Supabase session + send to backend ✓ |
| Verification | N/A (auto) | Frontend query ❌ | Backend endpoint ✓ |
| Data Source | Supabase | Supabase (anon) ❌ | Backend API ✓ |
| Database Access | Anon key ✓ | Anon key ❌ | Service role (in backend) ✓ |
| 2FA | N/A | Not implemented ❌ | Backend enforces ✓ |
| Page Status | Shows data ✓ | Blank ❌ | Shows data ✓ |
| RLS Status | Works correctly ✓ | Correctly denies ✓ | Works with service role ✓ |

---

## BEFORE vs AFTER VISUAL

### Before (Current - Broken)

```
┌─────────────────────────────────────────────┐
│         ADMIN DASHBOARD PAGE                │
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│  [Loading spinner spinning forever...]     │
│                                             │
│                                             │
│                                             │
└─────────────────────────────────────────────┘

Reason: adminDashboard.getSummary() → RLS denies → data = NULL
```

### After (Fixed - Working)

```
┌─────────────────────────────────────────────┐
│         ADMIN DASHBOARD PAGE                │
├─────────────────────────────────────────────┤
│                                             │
│  Total Items:  1,245    Total Users: 342   │
│  Pending Claims: 89     Trust Score Avg: 4.2 │
│                                             │
│  Items by Area:          Items by Category: │
│  ┌──────────────────┐    ┌──────────────┐  │
│  │ North: 345       │    │ Keys: 234    │  │
│  │ South: 298       │    │ Wallet: 189  │  │
│  │ East: 267        │    │ Phone: 156   │  │
│  │ West: 335        │    │ Other: 666   │  │
│  └──────────────────┘    └──────────────┘  │
│                                             │
│  Last 14 Days Trend:                        │
│  [Simple trend chart showing data]          │
│                                             │
└─────────────────────────────────────────────┘

Reason: adminAPI.analytics.summary() → Backend → Service role → Real data ✓
```

---

**Status:** Misalignments fully documented visually.  
**Next Step:** Implement using EXACT_FIX_IMPLEMENTATION_PLAN.md


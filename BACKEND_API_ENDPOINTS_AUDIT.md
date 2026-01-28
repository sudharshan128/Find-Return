# BACKEND API ENDPOINTS AUDIT
**Date:** January 8, 2026  
**Status:** Backend is READY but UNUSED by Frontend

---

## SUMMARY

✅ **Backend has ALL required endpoints**  
❌ **Frontend is NOT calling any of them**

The backend is fully functional with proper authentication, authorization, rate limiting, and audit logging. The issue is that the frontend (especially admin pages) queries Supabase directly instead of using the backend.

---

## AUTHENTICATION ROUTES
**Prefix:** `/api/admin/auth`

### POST /verify ✓ READY
**Purpose:** Verify admin after OAuth  
**Frontend should:** Call after getting Supabase token  
**Current status:** ❌ NOT CALLED

```typescript
Request body: None (uses Authorization header)
Response: {
  success: true,
  admin: {
    id: "...",
    email: "...",
    role: "super_admin|moderator|analyst"
  },
  requiresTwoFA: boolean
}
```

**Backend does:**
- ✓ Extracts user from Supabase token
- ✓ Checks admin_users table (service role)
- ✓ Verifies is_active status
- ✓ Logs login action
- ✓ Checks if 2FA required
- ✓ Returns clear response

### GET /profile ✓ READY
**Purpose:** Get current admin profile  
**Frontend should:** Call to refresh admin data  
**Current status:** ❌ NOT CALLED

```typescript
Response: {
  id: "...",
  email: "...",
  role: "super_admin|moderator|analyst",
  isActive: boolean,
  twoFAEnabled: boolean
}
```

### POST /logout ✓ READY
**Purpose:** Log admin logout  
**Frontend should:** Call on sign out  
**Current status:** ❌ NOT CALLED

```typescript
Response: {
  success: true,
  message: "Logged out successfully"
}
```

---

## ANALYTICS ROUTES
**Prefix:** `/api/admin/analytics`

### GET /summary ✓ READY
**Purpose:** Get dashboard summary (items, claims, users, etc.)  
**Frontend currently:** Calls `adminDashboard.getSummary()` → Direct Supabase RPC  
**Frontend should:** Call `/api/admin/analytics/summary`

**Access:** Any admin role (analyst, moderator, super_admin)

### GET /trends ✓ READY
**Purpose:** Get trend data over time  
**Query params:** `days=30` (default, max 365)  
**Frontend currently:** Calls `adminDashboard.getDailyStats()` → Direct Supabase  
**Frontend should:** Call `/api/admin/analytics/trends?days=30`

**Access:** Any admin role

### GET /areas ✓ READY
**Purpose:** Get geographic distribution of items  
**Frontend currently:** Calls `adminDashboard.getAreaStats()` → Direct Supabase  
**Frontend should:** Call `/api/admin/analytics/areas`

**Access:** Any admin role

---

## AUDIT ROUTES
**Prefix:** `/api/admin`

### GET /audit-logs ✓ READY
**Purpose:** Get admin audit logs (super_admin only)  
**Query params:** `limit=100`, `offset=0`, `admin_id=<filter>`  
**Frontend currently:** Calls `adminAuditLogs.getAll()` → Direct Supabase  
**Frontend should:** Call `/api/admin/audit-logs?limit=100&offset=0`

**Access:** super_admin ONLY (with 2FA)

### GET /login-history ✓ READY
**Purpose:** Get admin login history (super_admin only)  
**Query params:** `limit=100`, `offset=0`  
**Frontend currently:** Not implemented in frontend  
**Frontend should:** Call `/api/admin/login-history`

**Access:** super_admin ONLY

---

## 2FA ROUTES
**Prefix:** `/api/admin/2fa`

### POST /setup ✓ READY
**Purpose:** Generate 2FA secret for super_admin  
**Frontend currently:** Not implemented  
**Frontend should:** Call when user clicks "Enable 2FA"

```typescript
Response: {
  secret: "JBSWY3DPEBLW64TMMQ======",
  qrCodeUrl: "data:image/png;base64,...",
  message: "Scan this QR code..."
}
```

### POST /verify ✓ READY
**Purpose:** Verify 2FA secret and enable it  
**Frontend currently:** Not implemented  
**Frontend should:** Call after user scans QR and enters code

```typescript
Request body: {
  secret: "JBSWY3DPEBLW64TMMQ======",
  token: "123456"  // 6-digit code from authenticator
}

Response: {
  success: true,
  message: "2FA enabled"
}
```

### POST /verify-token ✓ READY
**Purpose:** Verify 2FA token during login  
**Frontend currently:** Not implemented  
**Frontend should:** Call when 2FA screen shows

```typescript
Request body: {
  token: "123456"  // 6-digit code
}

Response: {
  success: true,
  admin: { id, email, role }
}
```

**Tracks:**
- Failed attempts (max 3 = 10 min lockout)
- IP address
- User agent
- Timestamps

### POST /disable ✓ READY
**Purpose:** Disable 2FA for super_admin  
**Frontend currently:** Not implemented

### POST /recovery-codes ✓ READY
**Purpose:** Get recovery codes for super_admin

---

## MIDDLEWARE (All in place)

✓ `requireAuth` - Validates Supabase token
✓ `requireAdmin` - Checks admin_users table
✓ `requireSuperAdmin` - Checks role = super_admin
✓ `require2FA` - Validates 2FA verification
✓ Rate limiting - Per-action and per-user
✓ Error logging - All failures logged
✓ Action audit - All actions logged with context

---

## FRONTEND USAGE ANALYSIS

### What Frontend SHOULD Do

**On Admin Login:**
```javascript
// 1. Supabase OAuth
const { data, error } = await supabase.auth.signInWithOAuth({...});

// 2. Call backend to verify
const response = await fetch('/api/admin/auth/verify', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${session.access_token}` }
});

if (response.requiresTwoFA) {
  // 3. Show 2FA screen
  showTwoFAScreen();
} else {
  // 4. Load dashboard
  loadDashboard();
}
```

**On Admin Logout:**
```javascript
await fetch('/api/admin/auth/logout', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
await supabase.auth.signOut();
```

**Loading Dashboard:**
```javascript
// ✗ WRONG - Direct Supabase
const data = await supabase.rpc('get_admin_dashboard_data');

// ✓ CORRECT - Through backend
const response = await fetch('/api/admin/analytics/summary', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
```

---

## WHAT'S WRONG WITH DIRECT SUPABASE QUERIES

### Example: Admin Dashboard

**Frontend Code (WRONG):**
```javascript
const adminDashboard = {
  getSummary: async () => {
    const { data, error } = await supabase.rpc('get_admin_dashboard_data');
    // error: RLS denies access!
    return data;
  }
};
```

**Why it fails:**
1. Frontend uses anon key (no service role permission)
2. RLS policy requires `auth.uid() = admin_users.user_id AND admin_users.is_active = true`
3. But `get_admin_dashboard_data()` RPC uses service role functions internally
4. RLS policies are based on authenticated user, not token type
5. Result: `data = null`, admin dashboard shows blank

**Backend code (CORRECT):**
```typescript
// /api/admin/analytics/summary
router.get('/summary', requireAuth, requireAdmin, async (req, res) => {
  // Uses service role key to bypass RLS (trusted context)
  const summary = await supabase.getServiceClient()
    .rpc('get_admin_dashboard_data');
  // This works because service role ignores RLS
  res.json(summary);
});
```

---

## FIX PRIORITY

### CRITICAL (Breaks admin functionality)
1. ❌ `AdminAuthContext` - Not calling `/api/admin/auth/verify`
2. ❌ `AdminDashboardPage` - Not calling `/api/admin/analytics/summary`
3. ❌ Admin pages - Not calling any backend endpoints

### HIGH (Security issue)
4. ❌ 2FA - Not integrated with backend
5. ❌ Admin roles - Not verified via backend

### MEDIUM (Data completeness)
6. ❌ Audit logs - Not accessible from frontend

---

## CONFIRMATION CHECKLIST

After fixing, verify:

- [ ] Login flow calls `/api/admin/auth/verify`
- [ ] 2FA check works (if requiresTwoFA = true, show screen)
- [ ] Dashboard calls `/api/admin/analytics/summary`
- [ ] Admin pages call appropriate backend endpoints
- [ ] All requests include Authorization header
- [ ] Error handling for failed backend calls
- [ ] Fallback if backend is down (show error, not blank page)

---

## TESTING

### Test Admin Login
```bash
# 1. Get Supabase token via OAuth
# 2. Call backend verify
curl -X POST http://localhost:3000/api/admin/auth/verify \
  -H "Authorization: Bearer <supabase_token>"

# Should return:
{
  "success": true,
  "admin": { "id": "...", "email": "...", "role": "super_admin" },
  "requiresTwoFA": true/false
}
```

### Test Dashboard
```bash
curl http://localhost:3000/api/admin/analytics/summary \
  -H "Authorization: Bearer <supabase_token>"

# Should return dashboard data, not RLS error
```

---

## CONCLUSION

✅ **Backend is fully implemented and secure**  
❌ **Frontend is ignoring it and hitting Supabase directly**  
⚠️ **This causes RLS to deny admin queries**  
🔧 **Solution: Route admin queries through backend API**

The backend is production-ready. Frontend integration is the missing piece.


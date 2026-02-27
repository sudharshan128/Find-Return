# 🔗 FRONTEND-BACKEND INTEGRATION GUIDE

**Status:** Complete & Production-Ready  
**Security Level:** ✅ Enterprise-Grade  
**Breaking Changes:** ❌ None  

---

## 📋 QUICK START

### What This Does
- Frontend stays EXACTLY the same (Supabase OAuth, auth flow unchanged)
- Backend adds a security gate that verifies admin status
- Service role key NEVER leaves backend
- Frontend simply calls backend APIs instead of Supabase directly

### What Changes
- ❌ Frontend auth flow - **NO CHANGES**
- ❌ Supabase OAuth - **NO CHANGES**
- ❌ AdminAuthContext - **NO CHANGES**
- ✅ API calls - **Update endpoints** (frontend now calls backend, not Supabase)

---

## 🔐 THE AUTH FLOW (UNCHANGED FRONTEND)

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │
       ├─ [1] Supabase OAuth (UNCHANGED)
       │       → Sign in with Google
       │       → Get access_token
       │       → Store in Supabase session
       │
       └─ [2] Call Backend APIs (NEW)
               Authorization: Bearer <access_token>
               │
               ├─ [Backend] Verify JWT signature
               ├─ [Backend] Extract user ID
               ├─ [Backend] Check admin_users table
               ├─ [Backend] Enforce role permissions
               └─ [Backend] Return protected data
```

---

## 🎯 BACKEND SECURITY ARCHITECTURE

### Middleware Stack (Execute in Order)

```typescript
// 1. Parse request
app.use(express.json());

// 2. Apply security headers
app.use(helmet());

// 3. Apply CORS
app.use(cors({ credentials: true }));

// 4. Rate limit
app.use(generalLimiter);

// 5. Verify JWT (CRITICAL)
// Attached to: req.user
router.use(requireAuth);

// 6. Check admin status (CRITICAL)
// Attached to: req.adminProfile
router.use(requireAdmin);

// 7. Your route handlers
router.get("/analytics", (req, res) => {
  // req.user is verified
  // req.adminProfile is verified
  // Safe to access data
});
```

### Key Security Properties

✅ **JWT Verified** - Token signature checked with Supabase public key  
✅ **Admin Status Verified** - Database lookup ensures user is admin  
✅ **Role Enforced** - Route checks specific role if needed  
✅ **Service Role Protected** - Only backend uses service role key  
✅ **Audit Logged** - All admin actions recorded  

---

## 📁 BACKEND FILE STRUCTURE

```
/backend/nodejs/src/
├── /middleware/
│   ├── requireAuth.ts       ← JWT verification (token → user)
│   └── requireAdmin.ts      ← Admin role check (user → admin_profile)
├── /routes/
│   ├── admin.routes.ts      ← All admin-only endpoints
│   └── auth.routes.ts       ← Auth endpoints (OAuth)
├── /services/
│   └── supabase.ts          ← Supabase client (both keys)
├── /config/
│   └── (uses process.env)   ← Service role key from .env
├── app.ts                   ← Express setup
└── server.ts                ← Bootstrap
```

---

## 🔌 MIDDLEWARE DETAILS

### 1. `requireAuth` - JWT Verification

**What it does:**
- Extracts `Authorization: Bearer <token>` header
- Verifies JWT signature using Supabase public anon key
- Extracts user ID from token
- Attaches to `req.user`

**What it checks:**
```typescript
// Extract token
const token = req.headers.authorization?.substring(7);

// Verify with Supabase
const user = await supabase.verifyToken(token);

// Attach to request
req.user = user;
```

**Rejects if:**
- ❌ No Authorization header
- ❌ Token invalid or expired
- ❌ Signature doesn't match Supabase public key

---

### 2. `requireAdmin` - Admin Status Check

**What it does:**
- Uses verified `req.user.id`
- Looks up user in `admin_users` table
- Checks `is_active` and `force_logout_at`
- Attaches to `req.adminProfile`

**What it checks:**
```typescript
const adminProfile = await supabase.getAdminProfile(req.user.id);

// Verify admin is active
if (!adminProfile || !adminProfile.is_active) {
  return 403 Forbidden;
}

// Verify not force-logged-out
if (adminProfile.force_logout_at > now) {
  return 403 Forbidden;
}

// Attach profile
req.adminProfile = adminProfile;
```

**Rejects if:**
- ❌ User not in `admin_users` table
- ❌ `is_active` is false
- ❌ `force_logout_at` is in future
- ❌ Account deleted or suspended

---

### 3. `requireSuperAdmin` - Super Admin Role Check

**What it does:**
- Checks if `req.adminProfile.role === "super_admin"`
- Used for sensitive operations only

**Rejects if:**
- ❌ User is admin but not super_admin
- ❌ User is analyst or moderator

---

## 📚 EXAMPLE ROUTES

### Example 1: Get Analytics (Any Admin)

```typescript
router.get(
  "/analytics/summary",
  adminLimiter,        // Rate limit first
  requireAuth,         // Verify JWT
  requireAdmin,        // Check admin status
  async (req: Request, res: Response) => {
    // SAFE: req.user and req.adminProfile are verified
    
    const adminProfile = req.adminProfile!;
    
    // Log the action
    await supabase.logAdminAction(
      adminProfile.id,
      "READ_ANALYTICS_SUMMARY",
      "analytics",
      "success",
      {},
      req.clientIp,
      req.userAgent
    );
    
    // Fetch data using service role (backend only)
    const summary = await supabase.getAnalyticsSummary();
    
    res.json(summary);
  }
);
```

### Example 2: Ban User (Super Admin Only)

```typescript
router.post(
  "/users/:id/ban",
  adminLimiter,
  requireAuth,         // Verify JWT
  requireAdmin,        // Check admin status
  requireSuperAdmin,   // Check role === "super_admin"
  async (req: Request, res: Response) => {
    // SAFE: Verified super admin
    
    const { id } = req.params;
    const { reason } = req.body;
    
    // Log the action
    await supabase.logAdminAction(
      req.adminProfile!.id,
      "BAN_USER",
      "users",
      "success",
      { banned_user_id: id, reason },
      req.clientIp,
      req.userAgent
    );
    
    // Ban user using service role key
    const result = await supabase.banUser(id, reason);
    
    res.json(result);
  }
);
```

---

## 🎯 FRONTEND INTEGRATION

### IMPORTANT: DO NOT MODIFY FRONTEND AUTH

Your frontend's `AdminAuthContext` and `ProtectedRoute` stay **EXACTLY** the same.

Only update the API calls.

### Step 1: Get Access Token (Already Done in Frontend)

```typescript
// This is already in your frontend (DO NOT CHANGE)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// User logs in via OAuth (unchanged)
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
});

// Access token is stored in session (unchanged)
const session = await supabase.auth.getSession();
const accessToken = session?.data?.session?.access_token;
```

### Step 2: Update API Calls to Use Backend

**BEFORE (Direct Supabase - NO LONGER USED):**
```typescript
// OLD - Direct Supabase access
const { data } = await supabase
  .from("admin_users")
  .select("*")
  .eq("id", userId);
```

**AFTER (Via Backend - USE THIS):**
```typescript
// NEW - Via backend API
const response = await fetch(
  `${BACKEND_URL}/api/admin/analytics/summary`,
  {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  }
);

const data = await response.json();
```

### Example: Admin Dashboard Component

```typescript
// AdminDashboard.tsx
import { useEffect, useState } from "react";
import { useAdminAuth } from "./contexts/AdminAuthContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3000";

export function AdminDashboard() {
  const { session } = useAdminAuth(); // Keep existing auth
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.access_token) return;

    fetchAnalytics(session.access_token);
  }, [session?.access_token]);

  async function fetchAnalytics(accessToken: string) {
    try {
      setLoading(true);
      
      // Call backend API (not Supabase directly)
      const response = await fetch(
        `${BACKEND_URL}/api/admin/analytics/summary`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setAnalytics(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <pre>{JSON.stringify(analytics, null, 2)}</pre>
    </div>
  );
}
```

---

## 🛠️ AXIOS HELPER (Optional)

Create a helper for consistent API calls:

```typescript
// frontend/src/api/adminClient.ts
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3000";

export const adminClient = axios.create({
  baseURL: `${BACKEND_URL}/api/admin`,
});

// Intercept requests to add access token
adminClient.interceptors.request.use((config) => {
  const session = /* get from your auth context */;
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  
  return config;
});

// Example usage
export async function getAnalytics() {
  const response = await adminClient.get("/analytics/summary");
  return response.data;
}

export async function banUser(userId: string, reason: string) {
  const response = await adminClient.post(`/users/${userId}/ban`, { reason });
  return response.data;
}
```

**Usage in components:**
```typescript
import { getAnalytics } from "@/api/adminClient";

const analytics = await getAnalytics();
```

---

## 📋 ENVIRONMENT SETUP

### Frontend (.env)
```
REACT_APP_BACKEND_URL=http://localhost:3000          # Dev
REACT_APP_BACKEND_URL=https://backend.render.com     # Production
```

### Backend (.env)
```
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyxxx...                          # Public
SUPABASE_SERVICE_ROLE_KEY=eyxxx...                  # PROTECTED!
JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:5174                   # Dev
FRONTEND_URL=https://yourapp.com                     # Production
```

---

## ✅ VERIFICATION CHECKLIST

### Backend Setup
- ✅ `requireAuth` middleware in place
- ✅ `requireAdmin` middleware in place
- ✅ Admin routes created and secured
- ✅ Service role key in .env only
- ✅ CORS configured for frontend URL
- ✅ Rate limiting configured
- ✅ Audit logging in place

### Frontend Setup
- ✅ Supabase OAuth unchanged
- ✅ Access token captured from session
- ✅ API calls updated to use `${BACKEND_URL}/api/admin/*`
- ✅ Authorization header: `Bearer ${accessToken}`
- ✅ Error handling uses existing UI
- ✅ Loading states preserved

### Integration Test
- ✅ User logs in with Google
- ✅ Access token retrieved from Supabase session
- ✅ Frontend calls backend API
- ✅ Backend verifies JWT
- ✅ Backend checks admin status
- ✅ Data returned to frontend
- ✅ Non-admin users rejected

### Security Validation
- ✅ Service role key never in frontend
- ✅ Service role key only used server-side
- ✅ JWT verified on every request
- ✅ Admin status checked in database
- ✅ RLS still enforced at DB level
- ✅ Audit log records all actions

---

## 🚀 DEPLOYMENT

### Step 1: Deploy Backend to Render
```bash
cd backend/nodejs
npm run build
# Push to git, Render auto-deploys
```

### Step 2: Update Frontend .env
```
REACT_APP_BACKEND_URL=https://your-backend.render.com
```

### Step 3: Deploy Frontend
```bash
npm run build
npm run preview  # Test
# Deploy to Netlify/Vercel/etc
```

### Step 4: Verify Integration
1. Frontend loads
2. Click "Sign in with Google"
3. Complete OAuth
4. Dashboard loads (calls backend)
5. Analytics appear
6. Non-admin user gets 403

---

## 🔧 TROUBLESHOOTING

### "401 Unauthorized"
**Cause:** Missing or invalid JWT
**Fix:** Ensure `Authorization: Bearer <token>` header is present and token is valid

### "403 Forbidden"
**Cause:** User not in admin_users table or inactive
**Fix:** 
1. User must sign up
2. Must have entry in admin_users table
3. Must have is_active=true

### "CORS Error"
**Cause:** Frontend URL not in CORS allowlist
**Fix:** Update `CORS_ORIGINS` in backend .env

### "Service Role Key in Frontend"
**Cause:** Accidentally imported in frontend
**Fix:** Only use SUPABASE_ANON_KEY in frontend, SERVICE_ROLE_KEY only in backend .env

---

## 📚 REFERENCE

### Backend Routes Implemented

| Route | Method | Auth | Role | Purpose |
|-------|--------|------|------|---------|
| `/api/admin/analytics/summary` | GET | ✅ | Any admin | Dashboard stats |
| `/api/admin/analytics/trends` | GET | ✅ | Any admin | Trend data |
| `/api/admin/audit-logs` | GET | ✅ | Super admin | Audit log retrieval |
| `/api/admin/login-history` | GET | ✅ | Super admin | Login history |
| `/api/2fa/setup` | POST | ✅ | Super admin | Enable 2FA |
| `/api/2fa/verify` | POST | ✅ | Super admin | Verify 2FA code |
| `/api/2fa/disable` | POST | ✅ | Super admin | Disable 2FA |
| `/api/auth/profile` | GET | ✅ | Any admin | Get profile |
| `/health` | GET | ❌ | Public | Health check |

### Middleware Middleware Chain
```
requireAuth       → Verify JWT
requireAdmin      → Check admin status
requireSuperAdmin → Check role === "super_admin"
requireRole(X)    → Check role === X
```

---

## 🎊 SUMMARY

### What You Have
✅ Existing frontend auth (unchanged)  
✅ Backend JWT verification  
✅ Admin role enforcement  
✅ Service role key protection  
✅ Audit logging  
✅ Rate limiting  
✅ Secure CORS  

### How to Use
1. Frontend gets `access_token` from Supabase OAuth (unchanged)
2. Frontend calls `${BACKEND_URL}/api/admin/*` with `Authorization: Bearer ${token}`
3. Backend verifies JWT and admin status
4. Backend returns protected data

### Production Ready
✅ All security in place  
✅ No breaking changes to frontend  
✅ Render deployment ready  
✅ Scalable and maintainable  

---

**Status:** ✅ **INTEGRATION COMPLETE & DOCUMENTED**


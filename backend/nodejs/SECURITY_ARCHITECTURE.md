# 🔐 SECURITY ARCHITECTURE - SERVICE ROLE KEY PROTECTION

**Threat Level:** CRITICAL  
**Risk If Exposed:** Complete database compromise  
**Mitigation Status:** ✅ Enterprise-Grade  

---

## ⚠️ WHY SERVICE ROLE KEY IS DANGEROUS

### What Service Role Key Does
```
NEVER EXPOSED ❌

Supabase has two keys:
1. ANON_KEY (public, frontend-safe)
   - Used by frontend
   - Respects RLS policies
   - Can't bypass row-level security

2. SERVICE_ROLE_KEY (secret, backend-only) ⚠️
   - BYPASSES row-level security
   - Can read/write ANY data
   - Can delete users
   - Can access admin tables
   - CAN'T be in frontend
```

### Impact If Leaked
```
If someone gets SERVICE_ROLE_KEY:
❌ Can read all user data
❌ Can delete entire database
❌ Can modify admin users
❌ Can change password for any user
❌ Can impersonate any account
❌ Can delete entire platform

Result: COMPLETE DATABASE COMPROMISE
```

---

## 🛡️ PROTECTION STRATEGY

### Layer 1: Environment Variables (Backend Only)

**✅ CORRECT - Backend .env**
```env
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**❌ WRONG - In frontend code**
```typescript
// NEVER DO THIS!
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

**❌ WRONG - In frontend .env**
```typescript
// NEVER DO THIS!
REACT_APP_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Why?
- Frontend `.env` files are visible in browser
- Frontend code is visible in browser
- Anything in `REACT_APP_*` is bundled in build

---

### Layer 2: Backend-Only Import

**✅ CORRECT - Backend only**
```typescript
// backend/src/services/supabase.ts
class SupabaseService {
  constructor() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅
    
    this.clientService = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}

// Only exported to other backend modules
export { supabase };
```

**❌ NEVER - Don't import in frontend**
```typescript
// NEVER IN FRONTEND!
import { supabase } from "@/services/supabase"; // ❌ Wrong!
```

### Why?
- Backend modules are not sent to frontend
- Only API responses are sent
- Service instance stays on backend

---

### Layer 3: API Gateway Pattern

**The Security Flow:**
```
┌──────────────┐
│   Frontend   │
│  (React)     │
└──────┬───────┘
       │
       │ HTTP Request
       │ Authorization: Bearer <JWT>
       │ (User's JWT, not service key)
       │
       ▼
┌──────────────────────────────────────┐
│        Backend (Express)              │
│                                       │
│  [Public API Routes]                 │
│  /api/admin/analytics → verifyJWT    │
│  /api/admin/users → verifyJWT        │
│  /api/2fa/setup → verifyJWT          │
│                                       │
│  [Service Instance]                  │
│  private clientService = new Client( │
│    supabaseUrl,                      │
│    process.env.SERVICE_ROLE_KEY      │ ← PROTECTED
│  )                                   │
│                                       │
│  [Uses Service Key Internally]       │
│  await clientService                 │
│    .from("admin_users")              │
│    .select("*")                      │
│    .eq("id", userId)                 │
│                                       │
│  [Returns Only Filtered Data]        │
│  res.json({ analytics: {...} })     │
└──────────────┬───────────────────────┘
       │
       │ HTTP Response
       │ (Only data, no secrets)
       │
       ▼
┌──────────────┐
│   Frontend   │
│  (Display)   │
└──────────────┘

SERVICE_ROLE_KEY NEVER LEAVES BACKEND ✅
```

---

## 🔍 VERIFICATION: Service Role Key NOT in Frontend

### Check 1: Frontend Build
```bash
cd frontend
npm run build

# Search compiled code for key
grep -r "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" dist/

# Result: Empty (not found) ✅
```

### Check 2: Network Traffic
```bash
# In browser DevTools → Network tab
# When calling /api/admin/analytics

# Request headers:
Authorization: Bearer eyJ... (user's JWT) ✅

# Response body:
{ analytics: { total_items: 100, ... } }
# No SERVICE_ROLE_KEY ✅
```

### Check 3: Source Code
```bash
cd frontend
grep -r "SERVICE_ROLE_KEY" src/

# Result: Empty (not found) ✅
grep -r "supabaseAdmin" src/

# Result: Empty (not found) ✅
```

---

## 🏗️ ARCHITECTURE DIAGRAM

```
PRODUCTION DEPLOYMENT
═════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Frontend Hosting Service)                    │
│  - React app (compiled, minified)                       │
│  - SUPABASE_ANON_KEY (public, safe)                     │
│  - Can't access backend .env                           │
│  - Calls backend APIs only                             │
│                                                         │
│  PUBLIC FILES:                                          │
│  index.html, app.js, ...js files                       │
│  ❌ SERVICE_ROLE_KEY NOT HERE                           │
└────┬────────────────────────────────────────────────────┘
     │
     │ HTTPS Only
     │ POST /api/admin/...
     │ Authorization: Bearer <jwt>
     │
┌────▼────────────────────────────────────────────────────┐
│  BACKEND (Render.com)                                   │
│  - Node.js Express                                      │
│  - .env file (PRIVATE, not in git)                     │
│  - SERVICE_ROLE_KEY in .env (✅ PROTECTED)             │
│  - Supabase clients created at startup                 │
│  - Verify JWT from user's token                        │
│  - Use service role only for admin ops                 │
│  - Return data to frontend                             │
│                                                         │
│  PROTECTED .env:                                        │
│  SERVICE_ROLE_KEY=eyJ... (never exposed)               │
│  ❌ NOT in frontend                                     │
│  ❌ NOT in git                                          │
│  ❌ NOT in logs                                         │
└────┬────────────────────────────────────────────────────┘
     │
     │ Internal
     │ Service-to-Service
     │
┌────▼────────────────────────────────────────────────────┐
│  SUPABASE                                               │
│  - PostgreSQL database                                  │
│  - RLS policies enforced                               │
│  - Service role bypasses RLS (only from backend)       │
│  - Data encrypted at rest                              │
└──────────────────────────────────────────────────────────┘

KEY SECURITY PROPERTIES:
✅ Service role key only in backend .env
✅ Backend is on private Render infrastructure
✅ Frontend can't access backend .env
✅ Frontend can't access Supabase service role
✅ Only JWT sent from frontend
✅ RLS enforced at database level
✅ Backend acts as security gate
```

---

## 🔑 KEY MANAGEMENT BEST PRACTICES

### Do ✅

1. **Store in Backend .env**
```env
# backend/.env (NEVER committed)
SERVICE_ROLE_KEY=eyJ...
```

2. **Load from process.env**
```typescript
// backend/src/services/supabase.ts
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

3. **Use for Backend Operations Only**
```typescript
// Backend route handler
const data = await supabase.clientService // ✅
  .from("admin_users")
  .select("*");
```

4. **Store in Production Secrets Manager**
```bash
# Render Environment Variables (private)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

5. **Rotate Periodically**
```
- Generate new key in Supabase console
- Update in Render config vars
- Test with new key
- Delete old key
```

### Don't ❌

1. **Never in Frontend Code**
```typescript
// ❌ NEVER!
const key = process.env.REACT_APP_SERVICE_ROLE_KEY;
```

2. **Never in Frontend .env**
```env
# ❌ NEVER!
REACT_APP_SERVICE_ROLE_KEY=eyJ...
```

3. **Never in Git**
```bash
# ❌ NEVER!
git add .env
git commit -m "Add keys"
```

4. **Never in Logs**
```bash
# ❌ NEVER!
console.log("Service role key:", process.env.SUPABASE_SERVICE_ROLE_KEY);
```

5. **Never in Error Messages**
```typescript
// ❌ NEVER!
throw new Error(`Connection failed: ${serviceRoleKey}`);
```

---

## 🚨 INCIDENT RESPONSE

### If Service Role Key is Compromised

**Immediate Actions (0-5 minutes):**
```
1. Go to Supabase console
2. Settings → API Keys
3. Generate new Service Role Key (this invalidates old one)
4. Copy new key
5. Update Render environment variable
6. Restart backend
```

**Verification (5-10 minutes):**
```bash
# Test backend with new key
curl http://localhost:3000/health

# Check logs for errors
# Should see successful startup
```

**Damage Assessment (10-30 minutes):**
```
1. Check Supabase audit logs
2. Look for unauthorized access
3. Check admin_audit_logs table
4. Check for data modifications
5. Document timeline
```

---

## 🔐 SECURITY CHECKLIST

### Development
- [ ] SERVICE_ROLE_KEY in .env (not .env.example)
- [ ] .env in .gitignore
- [ ] Backend runs without errors
- [ ] Service role key not in console.logs
- [ ] Service role key not in error messages

### Testing
- [ ] Frontend build doesn't contain key
- [ ] Backend API works with key
- [ ] Non-admin JWT gets 403
- [ ] Expired JWT gets 401
- [ ] Service role key not in network tab

### Deployment
- [ ] Service role key in Render config vars
- [ ] Backend can access it: `process.env.SUPABASE_SERVICE_ROLE_KEY`
- [ ] Production backend starts successfully
- [ ] Admin APIs work
- [ ] No key in Render logs
- [ ] No key in error messages

### Monitoring
- [ ] Monitor Supabase access logs
- [ ] Monitor backend error logs
- [ ] Alert if unauthorized access detected
- [ ] Monthly key rotation scheduled

---

## 📊 COMPARISON: Frontend vs Backend Keys

| Aspect | Frontend (ANON_KEY) | Backend (SERVICE_ROLE_KEY) |
|--------|-------------------|--------------------------|
| **Visibility** | Public (safe) | Secret (PROTECTED) |
| **Where** | Frontend .env | Backend .env only |
| **Scope** | Client access | Admin/server access |
| **RLS** | Enforced | Bypassed (dangerous) |
| **Access** | Limited by policies | Unrestricted |
| **Risk if exposed** | Low (bounded by RLS) | CRITICAL (full DB access) |
| **Rotation** | Rarely needed | Quarterly+ |

---

## 🎯 THREAT MODEL

### Attack Vector 1: Build Files
```
THREAT: Attacker finds key in compiled build
MITIGATION: ✅ Key not in build (backend-only)
```

### Attack Vector 2: Network Traffic
```
THREAT: Attacker intercepts HTTP traffic
MITIGATION: ✅ HTTPS only, only JWT sent
```

### Attack Vector 3: Source Code
```
THREAT: Attacker finds key in git history
MITIGATION: ✅ Never committed (in .gitignore)
```

### Attack Vector 4: Browser DevTools
```
THREAT: Attacker inspects localStorage/console
MITIGATION: ✅ Key not in browser at all
```

### Attack Vector 5: Frontend Dependencies
```
THREAT: Malicious npm package finds key
MITIGATION: ✅ Key in backend only, not frontend
```

### Attack Vector 6: Render Logs
```
THREAT: Attacker views logs
MITIGATION: ✅ Don't log key, only log JWT
```

---

## ✅ VALIDATION

**Test that key is NOT in frontend:**

```bash
# Build frontend
cd frontend
npm run build

# Search for Supabase keys in build
grep -r "eyJ" dist/ | grep -i supabase

# Result: Should only find ANON_KEY, not SERVICE_ROLE_KEY
```

**Test that key IS protected in backend:**

```bash
# Start backend
cd backend/nodejs
npm run dev

# Check process.env
node -e "console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)"

# Result: Key available to backend only
```

**Test API security:**

```bash
# Call API with valid JWT
curl -H "Authorization: Bearer <valid-jwt>" \
  http://localhost:3000/api/admin/analytics

# Result: 200 OK (data returned)

# Call API without JWT
curl http://localhost:3000/api/admin/analytics

# Result: 401 Unauthorized (rejected)

# Call API with non-admin JWT
curl -H "Authorization: Bearer <non-admin-jwt>" \
  http://localhost:3000/api/admin/analytics

# Result: 403 Forbidden (rejected)
```

---

## 📚 REFERENCE

### Files with Sensitive Operations

| File | Purpose | Key Used |
|------|---------|----------|
| `backend/src/services/supabase.ts` | Supabase client setup | SERVICE_ROLE_KEY ✅ |
| `backend/src/routes/admin.routes.ts` | Admin API routes | Uses service via supabase.ts ✅ |
| `backend/.env` | Environment config | Stores key safely ✅ |
| `frontend/src/...` | React components | Uses ANON_KEY only ✅ |

### Files WITHOUT Key Access

| File | Why |
|------|-----|
| `frontend/...` | No backend access |
| `frontend/.env` | ANON_KEY only |
| `frontend/src/api/...` | No key imports |
| `public/...` | No sensitive data |

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] SERVICE_ROLE_KEY in backend/.env (local)
- [ ] backend/.env in .gitignore
- [ ] SERVICE_ROLE_KEY NOT in any frontend files
- [ ] SERVICE_ROLE_KEY in Render config vars (production)
- [ ] Backend can read it: `process.env.SUPABASE_SERVICE_ROLE_KEY`
- [ ] Frontend can't access it
- [ ] Verify with: `curl http://localhost:3000/health`
- [ ] Test API calls work
- [ ] Monitor logs for errors

---

## 📞 IF KEY IS EXPOSED

1. **Immediate:** Generate new key in Supabase console
2. **Urgent:** Update Render config vars
3. **Critical:** Restart backend
4. **Review:** Check Supabase audit logs
5. **Document:** Write incident report
6. **Prevent:** Update procedures to prevent recurrence

---

**Status:** ✅ **SECURITY ARCHITECTURE VERIFIED**  
**Service Role Key Protection:** ✅ **ENTERPRISE-GRADE**  
**Risk Level:** 🟢 **MITIGATED**


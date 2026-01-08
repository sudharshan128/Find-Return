# Node.js Backend - Complete Setup Guide

## 🚀 Overview

This is a **production-ready Node.js backend** built for replacing Supabase Deno Edge Functions. It's designed to be deployed on **Render** and provides:

- ✅ JWT authentication verification
- ✅ Role-based access control (admin, super_admin, moderator, analyst)
- ✅ TOTP-based 2FA for super admins
- ✅ Comprehensive audit logging
- ✅ Rate limiting and security hardening
- ✅ Analytics endpoints
- ✅ Graceful error handling

---

## 📋 Project Structure

```
backend/nodejs/
├── src/
│   ├── server.ts              # Entry point - handles startup/shutdown
│   ├── app.ts                 # Express app configuration
│   ├── routes/
│   │   ├── auth.routes.ts     # POST /admin/auth/*
│   │   ├── admin.routes.ts    # GET /admin/analytics, audit logs, etc
│   │   └── twofa.routes.ts    # POST /admin/2fa/*
│   ├── middleware/
│   │   ├── requireAuth.ts     # JWT verification + role enforcement
│   │   └── rateLimit.ts       # Express rate limiting
│   ├── services/
│   │   ├── supabase.ts        # Supabase client (CRITICAL)
│   │   └── twofa.service.ts   # TOTP 2FA implementation
│   ├── utils/
│   │   └── ip.ts              # IP extraction, sanitization
│   └── types/
│       └── express.d.ts       # TypeScript types for Express
├── package.json
├── tsconfig.json
├── .env.example
└── README.md (this file)
```

---

## 🔐 Security Architecture

### CRITICAL PRINCIPLES

1. **Supabase as Source of Truth**
   - Frontend sends: `Authorization: Bearer <supabase_token>`
   - Backend ALWAYS verifies JWT with Supabase
   - Backend NEVER trusts frontend role claims

2. **Service Role Key (Backend Only)**
   - Used ONLY by Node.js backend
   - NEVER exposed to frontend
   - Allows bypassing RLS for admin operations
   - Stored in `.env` (never in version control)

3. **Role Enforcement (Double Check)**
   - Middleware checks `admin_users` table
   - Verifies `is_active = true`
   - Respects `force_logout_at` timestamp
   - Blocks inactive admins immediately

4. **Rate Limiting**
   - General: 100 requests per 15 minutes
   - Admin ops: 50 requests per 15 minutes
   - Auth/2FA: 5-10 attempts per window
   - Keyed by client IP

5. **Audit Logging**
   - ALL admin actions logged to `admin_audit_logs`
   - Captures IP address, user agent, timestamp
   - Failure reasons included
   - Cannot be disabled

---

## 🚦 Authentication Flow

### Standard Admin Login

```
1. Frontend: React calls Supabase OAuth
   → Google login → Supabase JWT token

2. Frontend: Calls POST /api/admin/auth/verify
   Body: Authorization: Bearer <token>

3. Backend:
   → Verifies JWT with Supabase
   → Fetches admin_users record
   → Checks is_active = true
   → Checks force_logout_at
   → Logs login to admin_login_history
   → Returns { success: true, requiresTwoFA: false/true }

4. Frontend:
   - If requiresTwoFA = false → Show dashboard
   - If requiresTwoFA = true → Show 2FA input
```

### 2FA Flow (Super Admin Only)

```
1. Super admin user logs in (see above)

2. Backend returns { requiresTwoFA: true }

3. Frontend shows 2FA input screen

4. Frontend: Calls POST /api/admin/2fa/verify-login
   Body: { token: "123456" }

5. Backend:
   → Gets 2FA secret from admin_users table
   → Verifies 6-digit code with speakeasy
   → If valid → Returns { success: true }
   → If invalid → Returns 401 + logs failure

6. Frontend: User can now access dashboard
```

---

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
cd backend/nodejs
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# From Supabase project settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_JWT_SECRET=super-secret-key

# Server config
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5174
FRONTEND_ORIGIN=http://localhost:5174

# Rate limiting (optional)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ADMIN_RATE_LIMIT_MAX_REQUESTS=50

# 2FA (optional)
TOTP_WINDOW=2
```

### 3. Build TypeScript

```bash
npm run build
```

### 4. Start Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server will run on `http://localhost:3000`

---

## 📡 API Endpoints

### Authentication

```
POST /api/admin/auth/verify
- Verify admin after OAuth
- Requires: Authorization header with Supabase token
- Returns: { success, requiresTwoFA, admin }

GET /api/admin/auth/profile
- Get current admin profile
- Requires: Authorization header + admin role

POST /api/admin/auth/logout
- Log admin logout (audit trail)
- Requires: Authorization header + admin role
```

### 2FA (Super Admin Only)

```
POST /api/admin/2fa/setup
- Generate 2FA secret + QR code
- Requires: Authorization header + super_admin role
- Returns: { secret, qrCodeUrl }

POST /api/admin/2fa/verify
- Verify 2FA setup with 6-digit code
- Body: { secret, token }
- Requires: Authorization header + super_admin role

POST /api/admin/2fa/verify-login
- Verify 2FA during login
- Body: { token }
- Requires: Authorization header
- Called after OAuth, before dashboard access

POST /api/admin/2fa/disable
- Disable 2FA
- Requires: Authorization header + super_admin role

POST /api/admin/2fa/check
- Check if 2FA is required
- Requires: Authorization header
```

### Analytics (Any Admin)

```
GET /api/admin/analytics/summary
- Get high-level statistics
- Returns: { totalItems, totalClaims, totalReports, statistics }

GET /api/admin/analytics/trends?days=30
- Get trend data
- Query param: days (1-365, default 30)

GET /api/admin/analytics/areas
- Get geographic distribution
- Returns: [{ area, count }]
```

### Audit Logs (Super Admin Only)

```
GET /api/admin/audit-logs?limit=100&offset=0&admin_id=<filter>
- Get all admin actions
- Returns: { logs, total, limit, offset }

GET /api/admin/login-history?limit=100&offset=0
- Get admin logins
- Returns: { logins, total, limit, offset }
```

---

## 🛡️ Middleware Stack

### `requireAuth`
Verifies Supabase JWT token. MUST be first.

```typescript
app.get("/protected", requireAuth, (req, res) => {
  // req.user is set and verified
});
```

### `requireAdmin`
Verifies user is an admin. Attaches `req.adminProfile`. Must come AFTER `requireAuth`.

```typescript
app.get("/admin", requireAuth, requireAdmin, (req, res) => {
  // User is verified admin
  const profile = req.adminProfile;
});
```

### `requireSuperAdmin`
Verifies user is super_admin. Must come AFTER `requireAuth`.

```typescript
app.post("/sensitive", requireAuth, requireSuperAdmin, (req, res) => {
  // Only super_admin can access
});
```

### Rate Limiters

- `generalLimiter` - Applied globally
- `adminLimiter` - Applied to admin endpoints
- `authLimiter` - Applied to login attempts
- `twoFALimiter` - Applied to 2FA endpoints

---

## 📊 Database Tables Used

### `admin_users`
- `id` - UUID
- `email` - Admin email
- `role` - "super_admin" | "moderator" | "analyst"
- `is_active` - Boolean (block inactive admins)
- `force_logout_at` - Timestamp (force logout if set)
- `twofa_enabled` - Boolean
- `twofa_secret` - String (encrypted in production)
- `twofa_verified_at` - Timestamp (null = not verified)

### `admin_audit_logs`
- `id` - UUID
- `admin_id` - FK to admin_users
- `action` - String ("LOGIN", "READ_ANALYTICS", etc)
- `resource_type` - String ("admin_session", "analytics", etc)
- `resource_id` - Optional ID
- `status` - "success" | "failure"
- `details` - JSON (action-specific data)
- `ip_address` - String
- `user_agent` - String
- `created_at` - Timestamp

### `admin_login_history`
- `id` - UUID
- `admin_id` - FK to admin_users
- `login_at` - Timestamp
- `logout_at` - Optional timestamp
- `ip_address` - String
- `user_agent` - String

---

## 🚀 Deployment to Render

### 1. Create Render Service

1. Go to https://render.com
2. Create new "Web Service"
3. Connect GitHub repository
4. Set build command:
   ```
   cd backend/nodejs && npm install && npm run build
   ```
5. Set start command:
   ```
   node dist/server.js
   ```

### 2. Environment Variables

In Render dashboard, add:
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com
FRONTEND_ORIGIN=https://your-domain.com
```

### 3. Health Check

Render will automatically check `/health` endpoint. No configuration needed.

### 4. Deploy

Push to main branch → Render auto-deploys

---

## 🧪 Testing

### Test Authentication

```bash
curl -X GET http://localhost:3000/api/admin/auth/profile \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

### Test Rate Limiting

```bash
# Make 101 requests in 15 minutes
for i in {1..105}; do
  curl http://localhost:3000/health
done
# Request 101+ will be rate limited
```

### Test 2FA

```bash
# Setup 2FA
curl -X POST http://localhost:3000/api/admin/2fa/setup \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN"

# Verify with code from authenticator app
curl -X POST http://localhost:3000/api/admin/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"secret":"...", "token":"123456"}'
```

---

## 🔍 Troubleshooting

### Issue: "Invalid or expired token"

**Solution:**
- Token expired? Refresh in frontend
- Wrong token format? Should be "Bearer <token>"
- Supabase keys wrong? Check .env

### Issue: "Access denied - admin role required"

**Solution:**
- User not in `admin_users` table? Add them
- `is_active = false`? Set to true
- User past `force_logout_at`? Clear the timestamp

### Issue: 2FA not working

**Solution:**
- Only super_admin can use 2FA
- Moderator/analyst 2FA endpoints return 403
- 6-digit code from authenticator app?
- Clock skew? TOTP window is ±2 (90 seconds tolerance)

### Issue: Rate limited

**Solution:**
- Admin routes have lower limit (50 vs 100)
- 2FA attempts: 10 per 5 minutes
- Auth attempts: 5 per 15 minutes
- Limits are per IP address

---

## 📝 Key Files Explained

### `src/services/supabase.ts`
- **Purpose:** Supabase client (singleton)
- **Critical:** Uses SERVICE_ROLE_KEY for admin operations
- **Methods:**
  - `verifyToken(token)` - Verify JWT
  - `getAdminProfile(userId)` - Get admin from DB
  - `logAdminAction()` - Audit log
  - `updateTwoFASettings()` - 2FA persistence

### `src/middleware/requireAuth.ts`
- **Purpose:** JWT verification
- **Order:** MUST be first middleware
- **Attaches:** `req.user` (from Supabase)

### `src/services/twofa.service.ts`
- **Purpose:** TOTP 2FA implementation
- **Library:** speakeasy
- **Key Methods:**
  - `generateSecret()` - Create QR code
  - `verifyToken()` - Verify 6-digit code
  - `generateBackupCodes()` - (unused in Phase 3)

---

## 🎯 Next Steps

### Phase 3 (Current)
- ✅ Core backend built
- ✅ 2FA implemented
- ✅ Audit logging complete
- ⏳ Frontend integration needed

### Phase 4 (Future)
- Backup codes for 2FA
- SMS 2FA option
- IP whitelist for super admin
- Admin role management UI
- Advanced analytics dashboards

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review audit logs: `/api/admin/audit-logs`
3. Check server logs: `npm run dev`
4. Verify Supabase keys in `.env`

---

**🔒 SECURITY FIRST. NEVER SKIP AUTHENTICATION.**

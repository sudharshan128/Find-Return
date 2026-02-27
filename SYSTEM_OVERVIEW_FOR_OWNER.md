# 🧠 Your System Explained - What You Have RIGHT NOW

**Written for:** Project Owner  
**Not for:** New developers  
**Focus:** What exists and works today  
**Date:** January 8, 2026

---

## 1️⃣ WHAT IS YOUR WEBSITE TODAY?

### The Problem It Solves

You have a **lost-and-found platform** where:
- **Regular users** can report items they found or lost
- **Super admin staff** can see everything, manage reports, and make final decisions
- Everything tracks who did what and when (audit logs)

### Who Uses It

**Public Users** (regular people):
- Sign in with Google (OAuth)
- Upload items they found/lost
- Check if their item was claimed
- Message about items
- No special powers

**Admin Staff** (your team):
- Sign in with Google (same as public)
- Super admins: Full access to everything
- Moderators: Can manage reports
- Analysts: Can view analytics only
- All tracked in audit logs

---

## 2️⃣ HOW AUTHENTICATION WORKS (SIMPLE FLOW)

### For Regular Users (Public Login)

```
USER CLICKS "Sign in with Google"
         ↓
Frontend shows Google login popup
         ↓
Google verifies identity
         ↓
Google sends back token to your frontend
         ↓
Your frontend stores this token
         ↓
User now logged in ✅
```

**Important:** Your backend is NOT involved in this step. Supabase handles it.

### For Admin Staff (Admin Login)

```
ADMIN CLICKS "Sign in with Google"
         ↓
Same as above (Google login)
         ↓
Supabase recognizes this is an admin user
         ↓
Frontend asks backend: "Is this admin allowed?"
         ↓
Backend checks admin_users table in Supabase:
  - Does this user exist?
  - Is their role = super_admin/moderator/analyst?
  - Are they currently active (not deactivated)?
         ↓
Backend says YES or NO
         ↓
If YES → Admin dashboard loads ✅
If NO → Access denied ❌
```

### Where Supabase Fits

Supabase is your **database + identity provider**:
- Stores all user data (public + admin)
- Stores all passwords (handled securely by Supabase)
- Issues authentication tokens
- You ask Supabase: "Is this token valid?"
- Supabase says: "Yes, and here's who they are"

### Where Your Backend Fits

Your backend is a **security checkpoint**:
- Frontend says "Hi, I'm admin@company.com"
- Backend checks: "Are you REALLY an admin in my database?"
- Backend checks: "Are you ACTIVE (not locked out)?"
- Backend checks: "What's your role? (super_admin/moderator/analyst)"
- Backend logs this login for audit trail
- Backend says "Approved" or "Denied"

**Why this exists:** So someone can't fake being an admin in their browser console.

---

## 3️⃣ WHAT HAPPENS WHEN AN ADMIN LOGS IN

### The Actual Flow

```
STEP 1: Admin clicks Google login
        Supabase handles OAuth with Google ✅

STEP 2: Frontend gets Supabase token
        This proves: "Supabase verified this person" ✅

STEP 3: Frontend sends token to backend
        Says: POST /api/admin/auth/verify
        Body: { token: "..." }

STEP 4: Backend verifies the token
        Checks: "Is this token real? (asks Supabase)"
        Supabase says: "Yes, this is admin@company.com"

STEP 5: Backend checks admin_users table
        Query: "Does admin@company.com exist?"
        Query: "Is their role = super_admin/moderator/analyst?"
        Query: "Are they active (is_active = true)?"

STEP 6: Backend checks 2FA status
        Query: "Does this admin have 2FA enabled?"
        If YES → Frontend should show 2FA screen
        If NO → Admin goes straight to dashboard

STEP 7: Backend logs the login
        Writes to admin_audit_logs:
        { admin_id, action: "LOGIN", status: "success", ... }

STEP 8: Frontend navigates to dashboard
        Admin now sees the dashboard ✅
```

### Where 2FA Fits (Only Super Admin)

**Current status:** 2FA is BUILT but NOT ENFORCED

This means:
- The code exists
- The database columns exist
- The middleware exists
- **But it's not turned on yet** (no routes require it)

What will happen when you enable it:
1. Super admin logs in (same as above)
2. Backend checks: "Does this super_admin have twofa_enabled = true?"
3. If YES → Frontend shows 2FA verification screen
4. Admin enters 6-digit code from phone authenticator app
5. Backend verifies the code (only for super_admins)
6. If correct → Admin proceeds to dashboard
7. If wrong → Locked out after 3 failed attempts (10 minute lockout)

---

## 4️⃣ HOW FRONTEND AND BACKEND TALK

### What Your Frontend Is Responsible For

**In the browser** (`frontend/src/`):
- Render login page
- Show Google login button
- Capture the 6-digit 2FA code
- Render admin dashboard
- Show analytics, reports, audit logs
- Make API calls to backend
- Store Supabase token in browser
- Keep admin logged in

**The frontend can see and do:**
- Display pages
- Call backend APIs
- Store data locally
- Update the UI

**The frontend CANNOT see:**
- Database passwords
- Service role key (private key)
- Sensitive server secrets

### What Your Backend Is Responsible For

**On the server** (`backend/nodejs/src/`):
- Verify tokens with Supabase
- Check admin roles in database
- Fetch data from Supabase
- Check if admin is locked out (2FA)
- Log admin actions to audit trail
- Rate limit requests
- Send API responses
- Keep secrets safe

**The backend can see and do:**
- Access database directly
- Verify tokens with Supabase
- Check user roles
- Enforce security rules
- Log everything
- Lock users out

**The backend CANNOT see:**
- What's on the user's screen
- What the user's browser is doing
- Session state (unless stored in database)

### Why the Backend Exists At All

The browser is **not trustworthy**:
- User can inspect code with DevTools
- User can fake API responses locally
- User can pretend to be an admin in their console
- User can edit JavaScript on the fly

The backend is **trustworthy**:
- Code runs on YOUR server
- User cannot see or edit it
- Database checks are real
- Security rules are enforced

**Real example:**
```
❌ BAD (Frontend only):
   Frontend checks: "Are you an admin?"
   User goes to console and says: "yes"
   User gets access to admin panel

✅ GOOD (Frontend + Backend):
   Frontend says: "User claims to be admin"
   Backend checks database: "Is this person in admin_users?"
   Backend checks role: "Is their role = super_admin?"
   Backend verifies token with Supabase: "Real?"
   Only then grants access
```

---

## 5️⃣ WHAT IS RUNNING WHERE

### What Runs in Your Browser

```
your-domain.com/admin
├─ React app (frontend)
├─ Google login button
├─ Dashboard UI
├─ 2FA verification screen (exists but hidden)
└─ Talks to backend at: your-backend.onrender.com/api/admin/...
```

Your frontend:
- Built with React + Vite
- Runs in user's browser
- Sends API requests to backend
- Stores auth token locally

### What Runs on Your Backend Server

```
your-backend.onrender.com
├─ Node.js server (Express)
├─ Routes: /api/admin/...
├─ Middleware: check auth, check role, rate limiting
├─ Services: talk to Supabase
└─ Logs everything
```

Your backend:
- Deployed on Render.com
- Node.js with Express
- Written in TypeScript
- Listens for API requests
- Talks to Supabase

### What Supabase Handles Automatically

```
Supabase
├─ Database (PostgreSQL)
│  ├─ admin_users table
│  ├─ admin_audit_logs table
│  ├─ twofa_attempts table (rate limiting)
│  └─ All your data
├─ Auth system
│  ├─ OAuth with Google
│  ├─ Token generation
│  └─ User management
└─ Secure API
   └─ Your backend calls it
```

Supabase:
- Hosts your database
- Handles Google OAuth
- Issues tokens
- You ask it questions, it answers

---

## 6️⃣ WHAT IS ALREADY COMPLETE

### Stable Features (Working Today)

✅ **Public user authentication**
- Google login works
- User data stored
- Sessions persist

✅ **Admin authentication**
- Admin staff can login
- Role-based access (super_admin, moderator, analyst)
- Active/inactive status enforced

✅ **Admin dashboard**
- Analytics view
- Audit logs view
- Reports management

✅ **Comprehensive audit logging**
- Every admin action logged
- IP address recorded
- User agent recorded
- Timestamp recorded
- Search/filter audit logs

✅ **Security foundation**
- Tokens verified on every request
- Rate limiting enforced
- CORS configured
- Helmet security headers

### Security That Is Done

✅ **Frontend/Backend separation**
- Secrets not exposed in frontend
- Service role key (private key) only on backend

✅ **Token verification**
- Every admin request checked with Supabase

✅ **Role-based access**
- super_admin: Full access
- moderator: Manage reports
- analyst: View-only
- Database enforces roles

✅ **Audit trails**
- Every login logged
- Every action logged
- IP addresses tracked
- User agents tracked

✅ **Rate limiting**
- General endpoint protection (300 requests per hour)
- Admin endpoints protected
- Future: 2FA endpoints will have stricter limits

---

## 7️⃣ WHAT IS NOT ACTIVE YET

### Built But Not Enforced

⏳ **Two-factor authentication (2FA)**

What exists:
- Database columns added to admin_users:
  - `twofa_enabled` (boolean, default = false)
  - `twofa_secret` (encrypted TOTP secret)
  - `twofa_verified_at` (timestamp)
  - `twofa_backup_codes` (for recovery)
- Rate limiting table for 2FA attempts
- Backend service methods (8 functions)
- Backend API endpoints (4 routes)
- Frontend UI component (TwoFAVerification.jsx)
- Middleware code (require2fa.ts)

What's NOT happening:
- No routes enforce 2FA yet (middleware not attached)
- Super admins don't see 2FA screen on login
- 2FA is optional
- Feature is hidden behind a feature flag

Why it's not active:
- Still testing
- Preparing for safe rollout
- Creating monitoring procedures
- Planning emergency disable

When it will be active:
- After you review PHASE_3_GO_NO_GO_CHECKLIST.md
- After 15-minute post-deploy verification
- After 24-48 hour monitoring period
- Gradually (start with 1 route, expand)

---

## 8️⃣ WHAT CAN BREAK VS WHAT IS SAFE

### 🚨 DO NOT TOUCH (Will Break Things)

❌ **Supabase credentials** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- These are your database connection
- Changing them breaks everything
- Losing them exposes your database

❌ **Token verification logic** (requireAuth.ts)
- This is what makes security work
- Breaking it means anyone can be anyone
- Keep it exactly as is

❌ **Admin role checks** (requireAdmin, requireSuperAdmin)
- These enforce role-based access
- Breaking them means analysts see all data
- Keep it exactly as is

❌ **Audit logging** (logAdminLogin, logAdminAction)
- This is your compliance and security trail
- Removing it loses all records
- Keep it exactly as is

❌ **Database schema** (admin_users, admin_audit_logs)
- Adding/removing columns breaks API
- Renaming fields breaks queries
- Keep existing columns exactly as is

❌ **Frontend/Backend API contract**
- If backend changes response format
- Frontend breaks
- Keep API responses consistent

### ✅ SAFE TO MODIFY

✅ **Frontend UI**
- Change colors, fonts, layout
- Add new pages (as long as backend supports them)
- Update dashboard design
- Safe because it's just display

✅ **Error messages**
- Make them clearer
- Add more details
- Safe because they're just text

✅ **Rate limits**
- Can adjust (300 requests/hour, etc)
- Can add new limits
- Safe because they're just numbers

✅ **New analytics queries**
- Can add new charts
- Can add new reports
- Safe as long as you query admin_audit_logs correctly

✅ **New admin features**
- Can add new admin pages
- Can add new permissions
- Safe if you check roles first

✅ **Email templates, notifications**
- Can change content
- Can change timing
- Safe because they're not critical

✅ **Logging format**
- Can log more details
- Can add more fields
- Safe as long as you keep core fields

---

## 9️⃣ ONE SIMPLE DIAGRAM

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR WEBSITE ARCHITECTURE                │
└─────────────────────────────────────────────────────────────┘

BROWSER                    BACKEND                   SUPABASE
(Frontend)                 (Node.js)                 (Database)
═══════════════════════════════════════════════════════════════

Admin user types email
   │
   ├─→ Click "Sign in with Google"
   │
   ├─────────────────────────────────→ Supabase: OAuth with Google
   │                                  ↓
   │                       Google verifies identity
   │                                  ↓
   │←─────────────────────── Supabase sends token back
   │
   └─→ POST /api/admin/auth/verify { token }
       │
       ├──────────────────────────────→ Backend receives token
       │                               ↓
       │                    "Is this token real?"
       │                               ↓
       │        Backend asks Supabase: "Verify this token"
       │                               ↓
       │        Supabase: "Yes, it's admin@company.com"
       │                               ↓
       │         Backend queries database
       │              ├─ Is this user in admin_users?
       │              ├─ What's their role?
       │              └─ Are they active?
       │                               ↓
       │        Backend checks: "Does admin have 2FA?"
       │              ├─ If YES: "Show 2FA screen"
       │              └─ If NO: "Go to dashboard"
       │                               ↓
       │         Backend logs: "LOGIN SUCCESS"
       │                               ↓
       │←────────────────────── Backend: "Approved ✅"
       │
       └─→ Frontend shows dashboard
           (or 2FA screen if enabled)
           │
           ├─→ Admin clicks "View Audit Logs"
           │
           ├─ POST /api/admin/audit-logs
           │  ├──────────────→ Backend: "Get logs"
           │  │                ↓
           │  │     Backend queries Supabase
           │  │                ↓
           │  │     Supabase returns logs
           │  │                ↓
           │  │     Backend logs this action
           │  │                ↓
           │  └──────────────← Backend: Here are logs
           │
           └─→ Dashboard displays logs


KEY POINTS:
═══════════
1. Google OAuth: User ↔ Supabase (browser doesn't see credentials)
2. Token verified: Frontend → Backend → Supabase (every time)
3. Role checked: Backend → Supabase database (not in frontend)
4. Actions logged: Every admin action → audit_audit_logs table
5. 2FA enforced: Backend middleware (not yet attached)
```

---

## 🎯 THREE CRITICAL ANSWERS

### ❓ If Nothing Changes, This System Will Continue to Work Because...

**→ Authentication is decoupled from features**

- Supabase handles identity (Google OAuth)
- Your backend validates permissions
- Database stores roles correctly
- These three are independent

Even if you add new features, authentication keeps working because:
- Token verification doesn't change
- Role checking doesn't change
- Supabase doesn't change

The system has a solid foundation.

---

### ❓ The Biggest Risk Right Now Is...

**→ Activating 2FA without proper monitoring**

Here's why:
- 2FA code is built but untested in production
- Super admins could get locked out
- No escape hatch (yet)
- Could block your entire admin team

Secondary risks:
- Exposing the service role key (would lose database security)
- Changing authentication logic (would break all logins)
- Database schema changes (would break API)

2FA risk is temporary (can be disabled in <5 min with PHASE_3_EMERGENCY_DISABLE.md)

Other risks are permanent (would take hours to fix)

---

### ❓ The Safest Next Step Is...

**→ Activate 2FA conservatively, with a way to turn it off**

What "conservatively" means:
1. Deploy 2FA to production ✅
2. Test with 15-minute verification ✅
3. Monitor for 24-48 hours ✅
4. Start with 1 route only (audit-logs) ✅
5. Expand after 24 hours if stable ✅
6. If issues → disable in <5 minutes ✅

You have:
- [PHASE_3_RENDER_DEPLOYMENT.md](PHASE_3_RENDER_DEPLOYMENT.md) - Deploy safely
- [PHASE_3_POST_DEPLOY_VERIFICATION.md](PHASE_3_POST_DEPLOY_VERIFICATION.md) - Test thoroughly
- [PHASE_3_MONITORING_PLAN.md](PHASE_3_MONITORING_PLAN.md) - Watch for problems
- [PHASE_3_EMERGENCY_DISABLE.md](PHASE_3_EMERGENCY_DISABLE.md) - Disable if needed

You're ready. Just follow the checklist.

---

## 📋 QUICK REFERENCE

### System Components

| Component | What It Does | Who Runs It | When Needed |
|-----------|-------------|-----------|------------|
| Frontend | Display pages, buttons | Browser | Always |
| Backend | Check permissions, log actions | Render.com | Always |
| Supabase | Store data, verify tokens | Supabase.com | Always |
| Google | Verify login credentials | Google | Login only |

### Important Tables

| Table | What's In It | Used For |
|-------|-------------|---------|
| admin_users | Admin staff info, roles, 2FA status | Access control |
| admin_audit_logs | Every admin action | Compliance, debugging |
| twofa_attempts | Failed 2FA codes | Rate limiting |

### Key Files (Don't Touch)

- `backend/nodejs/src/middleware/requireAuth.ts` (auth check)
- `backend/nodejs/src/middleware/requireAdmin.ts` (role check)
- `backend/nodejs/src/services/supabase.ts` (database connection)
- `.env` (Supabase credentials)

### Key Files (Can Modify)

- `frontend/src/pages/AdminDashboard.jsx` (UI)
- `backend/nodejs/src/routes/admin.routes.ts` (add new endpoints)
- Anything in `frontend/src/admin/` (admin UI)

---

## ✅ YOU NOW UNDERSTAND

- What your website does (lost & found platform)
- How people login (Google OAuth + role check)
- Why you have a backend (security checkpoint)
- What Supabase does (database + identity)
- What's built (2FA code + infrastructure)
- What's not active (2FA enforcement)
- What will break (auth logic, database structure)
- What's safe (UI, new features)
- How to proceed safely (conservative rollout with monitoring)

**Next action:** Read [PHASE_3_GO_NO_GO_CHECKLIST.md](PHASE_3_GO_NO_GO_CHECKLIST.md) when ready to deploy 2FA.

**Questions?** Every part of this system is documented. You own it now.

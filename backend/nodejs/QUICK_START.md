# Quick Start Guide

## ⚡ Get Running in 5 Minutes

### 1. Setup Environment (1 min)

```bash
cd backend/nodejs
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 2. Install & Build (2 min)

```bash
npm install
npm run build
```

### 3. Start Dev Server (1 min)

```bash
npm run dev
# Server runs on http://localhost:3000
```

### 4. Test It Works (1 min)

```bash
curl http://localhost:3000/health
# Should return: { "status": "healthy", "timestamp": "..." }
```

---

## 📂 File Overview

| File | Purpose |
|------|---------|
| `src/server.ts` | Entry point, startup/shutdown |
| `src/app.ts` | Express app, middleware stack |
| `src/routes/auth.routes.ts` | POST /admin/auth/* endpoints |
| `src/routes/admin.routes.ts` | Admin & analytics endpoints |
| `src/routes/twofa.routes.ts` | 2FA endpoints |
| `src/middleware/requireAuth.ts` | JWT verification |
| `src/middleware/rateLimit.ts` | Rate limiting config |
| `src/services/supabase.ts` | Supabase client (CRITICAL) |
| `src/services/twofa.service.ts` | TOTP 2FA logic |
| `src/utils/ip.ts` | IP extraction & sanitization |
| `src/types/express.d.ts` | TypeScript types |

---

## 🔐 Key Concepts

### Service Role Key (CRITICAL)
- Backend ONLY (never frontend)
- Used for admin operations
- Stored in `.env`
- Never logged

### JWT Token
- Sent by frontend in Authorization header
- Verified with Supabase on every request
- Never trusted on frontend claims
- Always check database for actual role

### Role Enforcement
- Database check: `admin_users` table
- Check `is_active` and `force_logout_at`
- Middleware AND query-level verification
- Blocks inactive/forced-logout admins

### 2FA (Super Admin Only)
- TOTP-based (offline authenticator app)
- 6-digit code, 30-second window
- Optional for super_admin
- Moderator/analyst skip automatically

---

## 📡 API Quick Reference

### Test Authentication
```bash
# Replace TOKEN with real Supabase token
curl -X GET http://localhost:3000/api/admin/auth/profile \
  -H "Authorization: Bearer TOKEN"
```

### Test Analytics
```bash
curl -X GET http://localhost:3000/api/admin/analytics/summary \
  -H "Authorization: Bearer TOKEN"
```

### Test 2FA Setup
```bash
curl -X POST http://localhost:3000/api/admin/2fa/setup \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

---

## 🚨 Critical Environment Variables

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_JWT_SECRET=your-secret
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5174
```

**NEVER COMMIT .env TO GIT!**

---

## 🚀 Deploy to Render

1. Go to render.com
2. Create new Web Service
3. Build: `cd backend/nodejs && npm install && npm run build`
4. Start: `node dist/server.js`
5. Add env vars
6. Deploy!

See `RENDER_DEPLOYMENT.md` for details.

---

## 🔗 Frontend Integration

Frontend needs to:
1. Get Supabase JWT token after OAuth
2. Send in `Authorization: Bearer <token>` header
3. Call your backend API endpoints
4. Handle 2FA flow for super_admin

See `FRONTEND_INTEGRATION.md` for implementation.

---

## ✅ Verify Installation

Run this checklist:

- [ ] `npm install` succeeded
- [ ] `npm run build` produces dist/ folder
- [ ] `npm run dev` starts without errors
- [ ] `curl http://localhost:3000/health` works
- [ ] `.env` file created with real credentials
- [ ] All env vars set correctly
- [ ] No TypeScript errors: `npm run type-check`

---

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| "Cannot find module..." | Run `npm install` |
| "Missing env var" | Check `.env` file |
| "Port already in use" | Change PORT in .env or kill process |
| "CORS error" | Check FRONTEND_URL matches frontend |
| "401 Unauthorized" | Token invalid or expired |
| "403 Forbidden" | User not admin or inactive |

---

## 📚 Full Docs

- **Complete guide:** `README.md`
- **Render deployment:** `RENDER_DEPLOYMENT.md`
- **Frontend setup:** `FRONTEND_INTEGRATION.md`
- **Implementation details:** `IMPLEMENTATION_SUMMARY.md`

---

## 🎯 What Works

✅ JWT verification  
✅ Role-based access control  
✅ 2FA for super admin  
✅ Audit logging  
✅ Rate limiting  
✅ Analytics endpoints  
✅ Error handling  
✅ Security hardening  

---

## ⚠️ Remember

1. **Never expose service role key**
2. **Always verify JWT**
3. **Always check role in database**
4. **Always log admin actions**
5. **Always use HTTPS in production**

---

**You're ready to go! 🚀**

Questions? Check the docs in this folder.

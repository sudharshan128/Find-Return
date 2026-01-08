# 📋 ENVIRONMENT VARIABLES REFERENCE TABLE

**Final Audit Report** | Backend Environment Configuration

---

## 🎯 COMPLETE VARIABLE REFERENCE

### GROUP 1: SERVER CONFIGURATION (2 variables)

| Variable | Value | Type | Required | Used In | Purpose |
|----------|-------|------|----------|---------|---------|
| `PORT` | 3000 | Integer | ✅ Yes | server.js, env.js | Express server port |
| `NODE_ENV` | development | String | ✅ Yes | env.js, logger.js | Environment flag (dev/prod) |

### GROUP 2: SUPABASE AUTHENTICATION (4 variables)

| Variable | Value | Type | Required | Used In | Purpose |
|----------|-------|------|----------|---------|---------|
| `SUPABASE_URL` | https://...co | String | ✅ Yes | env.js, supabase.js | Supabase project URL |
| `SUPABASE_ANON_KEY` | eyJ... | String | ✅ Yes | env.js, supabase.js | Public anon key (OAuth) |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJ... | String | ✅ Yes | env.js, supabase.js | Backend-only admin key |
| `SUPABASE_JWT_SECRET` | eyJ... | String | ✅ Yes | env.js | JWT token validation |

### GROUP 3: CORS & FRONTEND INTEGRATION (2 variables)

| Variable | Value | Type | Required | Used In | Purpose |
|----------|-------|------|----------|---------|---------|
| `FRONTEND_URL` | http://localhost:5174 | String | ✅ Yes | app.ts | Frontend URL for CORS |
| `FRONTEND_ORIGIN` | http://localhost:5174 | String | ✅ Yes | app.ts | Frontend origin for CORS |

### GROUP 4: SECURITY & RATE LIMITING (3 variables)

| Variable | Value | Type | Required | Used In | Purpose |
|----------|-------|------|----------|---------|---------|
| `RATE_LIMIT_WINDOW_MS` | 900000 | Integer | ❌ No (default: 15 min) | rateLimit.ts, env.js | Rate limit time window |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Integer | ❌ No (default: 100) | rateLimit.ts, env.js | Requests per window |
| `TOTP_WINDOW` | 2 | Integer | ❌ No (default: 2) | twofa.service.ts | 2FA code tolerance steps |

### GROUP 5: ENCRYPTION & LOGGING (2 variables)

| Variable | Value | Type | Required | Used In | Purpose |
|----------|-------|------|----------|---------|---------|
| `ENCRYPTION_KEY` | 64-char hex | String | ❌ No (dev default) | encryption.js, env.js | AES-256-GCM encryption key |
| `LOG_LEVEL` | info | String | ❌ No (default: info) | env.js, logger.js | Winston logging level |

---

## 📊 VARIABLE USAGE MATRIX

```
Variable                        | Code Location      | Call Type   | Used Count
--------------------------------|--------------------|-----------  |-----------
PORT                            | server.js          | Direct      | 1
NODE_ENV                         | env.js, logger.js  | Via env obj | 3+
SUPABASE_URL                     | supabase.js        | Via env obj | 1
SUPABASE_ANON_KEY               | supabase.js        | Via env obj | 1
SUPABASE_SERVICE_ROLE_KEY       | supabase.js        | Via env obj | 1
SUPABASE_JWT_SECRET             | env.js validation  | Via env obj | 1
FRONTEND_URL                     | app.ts             | Direct      | 1
FRONTEND_ORIGIN                  | app.ts             | Direct      | 1
RATE_LIMIT_WINDOW_MS            | env.js             | Direct      | 2+
RATE_LIMIT_MAX_REQUESTS         | env.js             | Direct      | 2+
TOTP_WINDOW                      | twofa.service.ts   | Direct      | 1
ENCRYPTION_KEY                   | encryption.js      | Via env obj | 2+
LOG_LEVEL                        | env.js             | Direct      | 1
```

---

## ✅ VARIABLE LIFECYCLE

### 1. LOADING (src/config/env.js)
```javascript
// Helper functions extract from process.env
const getRequired(key)      // Throws if missing
const getOptional(key, def) // Returns default if missing
const getInt(key, def)      // Parses integer
const getList(key, def)     // Parses comma-separated list

// Environment object exports all configured variables
export default env
```

### 2. USAGE (throughout app)
```javascript
// Option A: Via env object (recommended)
import { env } from '../config/index.js'
console.log(env.port)
console.log(env.supabase.url)

// Option B: Direct process.env (legacy - do not use)
const port = process.env.PORT || 3000 // ❌ Avoid
```

### 3. VALIDATION (on startup)
```javascript
// config/env.js
validateConfig() {
  // Checks SUPABASE_URL starts with https://
  // Checks ENCRYPTION_KEY in production
  // Throws on configuration errors
}
```

---

## 🔐 SECURITY CLASSIFICATION

### 🟢 PUBLIC (Can be in .env.example)
```
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5174
FRONTEND_ORIGIN=http://localhost:5174
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
TOTP_WINDOW=2
LOG_LEVEL=info
```

### 🔴 SECRET (NEVER in .env.example)
```
SUPABASE_URL                 (Contains project ID)
SUPABASE_ANON_KEY            (Public JWT but sensitive)
SUPABASE_SERVICE_ROLE_KEY    (CRITICAL - Backend only)
SUPABASE_JWT_SECRET          (JWT signing key)
ENCRYPTION_KEY               (Data encryption key)
```

---

## 🛑 REMOVED VARIABLES (Justification)

| Variable | Was In | Reason Removed | Reference |
|----------|--------|----------------|-----------|
| DATABASE_URL | .env | Not used (Supabase only) | See .env.local for old value |
| HOST | .env | Express doesn't read this | Not in any code |
| API_VERSION | .env.example | Hardcoded in code | Keep in src/config if needed |
| CORS_ORIGINS | .env.example | Replaced by FRONTEND_URL | FRONTEND_URL is used in app.ts |
| STRICT_RATE_LIMIT_WINDOW_MS | .env.example | Configured but never used | Not implemented in middleware |
| STRICT_RATE_LIMIT_MAX_REQUESTS | .env.example | Configured but never used | Not implemented in middleware |
| MAX_FILE_SIZE_MB | .env.example | In env.js but not used | Supabase enforces limits |
| ALLOWED_FILE_TYPES | .env.example | In env.js but not used | Not checked in middleware |
| MAX_ITEMS_PER_DAY | .env.example | Business logic not in backend | Frontend or database rules |
| MAX_CLAIMS_PER_ITEM | .env.example | Business logic not in backend | Frontend or database rules |
| MAX_CLAIMS_PER_USER_PER_DAY | .env.example | Business logic not in backend | Frontend or database rules |
| CLAIM_COOLDOWN_HOURS | .env.example | Business logic not in backend | Frontend or database rules |
| AUTO_BAN_THRESHOLD | .env.example | Business logic not in backend | Frontend or database rules |

---

## 🚀 ENVIRONMENT PROFILES

### Development (.env)
```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://yrdjpuvmijibfilrycnu.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=eyJ...
FRONTEND_URL=http://localhost:5174
FRONTEND_ORIGIN=http://localhost:5174
ENCRYPTION_KEY=(dev default)
LOG_LEVEL=debug
```

### Production (Render)
```env
NODE_ENV=production
PORT=[assigned by Render]
SUPABASE_URL=https://yrdjpuvmijibfilrycnu.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=eyJ...
FRONTEND_URL=https://yourdomain.com
FRONTEND_ORIGIN=https://yourdomain.com
ENCRYPTION_KEY=<32-byte hex>
LOG_LEVEL=info
```

---

## 📌 CRITICAL RULES

### ✅ MUST DO
- ✅ `SUPABASE_SERVICE_ROLE_KEY` only in `.env` (backend)
- ✅ Never commit `.env` to Git
- ✅ Always have `.env.example` without secrets
- ✅ Use env object (not process.env directly)
- ✅ Set `ENCRYPTION_KEY` in production
- ✅ Validate config on startup

### ❌ MUST NOT DO
- ❌ Expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- ❌ Hardcode secrets in code
- ❌ Commit `.env` to repository
- ❌ Use wildcard CORS origins
- ❌ Skip encryption in production
- ❌ Log sensitive variables

---

## 🔗 REFERENCES

**Frontend URL Configuration:**
- FRONTEND_URL: Used in app.ts for CORS origin
- FRONTEND_ORIGIN: Backup CORS origin setting
- Both should match frontend dev/production URL

**Supabase Configuration:**
- SUPABASE_URL: From Supabase Dashboard > Settings > API
- SUPABASE_ANON_KEY: From same location, public key
- SUPABASE_SERVICE_ROLE_KEY: From same, SECRET key
- SUPABASE_JWT_SECRET: From JWT Settings

**Rate Limiting:**
- Default: 100 requests per 15 minutes
- Can be adjusted per environment
- Admins bypass rate limiting

**Encryption:**
- Development: Uses derived key (logged warning)
- Production: REQUIRES 32-byte hex key (64 characters)
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Logging:**
- Development: `debug` (verbose)
- Production: `info` (normal) or `warn` (minimal)
- Levels: error | warn | info | debug | verbose

---

**Status:** ✅ COMPLETE  
**Last Updated:** 2026-01-08  
**Maintained By:** DevOps Team

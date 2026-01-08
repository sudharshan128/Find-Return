# 🔍 Lost & Found Bangalore

A production-ready, secure Lost & Found platform designed specifically for Bangalore, India. Built with a Zero Trust architecture using Supabase, React, and Express.js.

## 🎯 Problem Statement

In Bangalore, a city of over 12 million people:
- **People lose valuable belongings daily** - phones, wallets, documents, keys
- **Finders have no reliable way to return items** - no centralized system exists
- **Fake claims are rampant** - scammers exploit lost item situations
- **Ownership verification is difficult** - no secure way to prove ownership
- **Privacy concerns** - sharing contact details with strangers is risky

## 💡 Solution

A secure, trust-based platform that:
- **Anonymizes finders** - protects their identity until verified
- **Verifies ownership** - through security questions only owners can answer
- **Prevents abuse** - rate limiting, duplicate detection, auto-flagging
- **Enables safe handover** - in-app masked chat, no personal info exposed
- **Builds community trust** - trust scores, verified returns

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  React + Vite + Tailwind CSS + React Router                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  UI Components │ Pages │ Auth Context │ Supabase Client  │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ JWT Auth
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  Node.js + Express.js + Supabase Admin SDK                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Auth Middleware │ Rate Limiter │ Validators │ Controllers │  │
│  │ Services │ Encryption │ Audit Logger │ Error Handler      │  │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Service Role
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │ PostgreSQL│  │   Auth    │  │  Storage  │  │ Realtime  │    │
│  │    + RLS  │  │  Google   │  │  Buckets  │  │  Pub/Sub  │    │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Edge Functions (Deno)                       │   │
│  │  verify-claim │ detect-abuse │ cleanup │ strip-metadata  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Zero Trust Principles

1. **Never trust the client** - All validation happens server-side
2. **JWT verification on every request** - No cached sessions
3. **User ID from token only** - Never from request body
4. **Role-based access** - Granular permissions
5. **Rate limiting everywhere** - Abuse prevention
6. **Audit logging** - Complete trail of actions
7. **Encrypted sensitive data** - AES-256-GCM encryption

---

## 📁 Project Structure

```
lost-found-bangalore/
├── frontend/                    # React Frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── auth/          # Protected routes
│   │   │   ├── claims/        # Claim forms
│   │   │   ├── items/         # Item cards, grids, filters
│   │   │   └── layout/        # Navbar, Layout
│   │   ├── contexts/          # React contexts
│   │   │   └── AuthContext    # Supabase auth state
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Supabase client & helpers
│   │   ├── pages/             # Route pages
│   │   │   ├── HomePage       # Browse items
│   │   │   ├── ItemDetailPage # Item details + claim
│   │   │   ├── ReportFoundPage# Report found item
│   │   │   ├── MyClaimsPage   # User's claims
│   │   │   ├── MyItemsPage    # User's posted items
│   │   │   ├── ItemClaimsPage # Claims on user's item
│   │   │   ├── ChatsPage      # All chats
│   │   │   ├── ChatPage       # Single chat room
│   │   │   ├── ProfilePage    # User profile
│   │   │   ├── AdminDashboard # Admin panel
│   │   │   └── LoginPage      # Auth page
│   │   └── utils/             # Utility functions
│   ├── .env                   # Environment variables
│   └── package.json
│
├── backend/                    # Express.js Backend
│   ├── src/
│   │   ├── config/            # Configuration
│   │   │   ├── env.js         # Environment management
│   │   │   ├── supabase.js    # Supabase clients
│   │   │   └── logger.js      # Winston logger
│   │   ├── middlewares/       # Express middlewares
│   │   │   ├── auth.js        # JWT verification
│   │   │   ├── rateLimiter.js # Rate limiting
│   │   │   ├── validate.js    # Joi validation
│   │   │   ├── upload.js      # Image upload
│   │   │   ├── auditLogger.js # Audit logging
│   │   │   └── errorHandler.js# Error handling
│   │   ├── services/          # Business logic
│   │   │   ├── userService.js
│   │   │   ├── itemService.js
│   │   │   ├── claimService.js
│   │   │   ├── chatService.js
│   │   │   ├── reportService.js
│   │   │   └── adminService.js
│   │   ├── controllers/       # Route handlers
│   │   ├── routes/            # API routes
│   │   └── utils/             # Utilities
│   │       ├── encryption.js  # AES-256 encryption
│   │       └── response.js    # API response helpers
│   ├── supabase/
│   │   └── functions/         # Edge Functions
│   │       ├── verify-claim/
│   │       ├── detect-abuse/
│   │       ├── scheduled-cleanup/
│   │       └── strip-image-metadata/
│   ├── .env                   # Environment variables
│   └── package.json
│
├── supabase/                   # Database Schema
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_storage_policies.sql
│
└── README.md                   # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase account (free tier works)
- Git

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/lost-found-bangalore.git
cd lost-found-bangalore
```

### 2. Supabase Setup

#### Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your **Project URL** and **API Keys**

#### Run Database Migrations
1. Go to SQL Editor in Supabase Dashboard
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/migrations/002_storage_policies.sql`

#### Create Storage Buckets
1. Go to Storage > Create new bucket
2. Create buckets:
   - `items` (public) - For item images
   - `claims` (private) - For claim proof
   - `avatars` (public) - For profile pictures

#### Configure Authentication
1. Go to Authentication > Providers
2. Enable Google OAuth:
   - Add Client ID from Google Cloud Console
   - Add Client Secret
   - Set redirect URL: `https://your-project.supabase.co/auth/v1/callback`

### 3. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
NODE_ENV=development
PORT=3001

# Supabase (from Dashboard > Settings > API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Security (generate 32 char random string)
ENCRYPTION_KEY=your-32-character-encryption-key

# CORS
CORS_ORIGINS=http://localhost:5173
```

Start backend:
```bash
npm run dev
```

### 4. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001/api/v1
```

Start frontend:
```bash
npm run dev
```

### 5. Access Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/api/v1/health

---

## 📱 Core Features

### For Finders (People who found items)

1. **Report Found Item**
   - Upload photos (metadata auto-stripped)
   - Select category and Bangalore area
   - Set security question
   - Item appears anonymously

2. **Review Claims**
   - View claim descriptions
   - See encrypted answers decrypted
   - Approve or reject with reason

3. **Safe Handover**
   - Chat opens only after approval
   - No personal details exposed
   - Mark item as returned

### For Owners (People who lost items)

1. **Browse Items**
   - Filter by area, category, date
   - Search by keywords
   - Server-side pagination

2. **Claim Item**
   - Answer security question
   - Provide proof description
   - Limited to 3 claims per item

3. **Track Claims**
   - View claim status
   - Chat when approved
   - Arrange handover

### For Admins

1. **Dashboard**
   - User statistics
   - Item statistics
   - Report statistics

2. **Moderation**
   - Review flagged items
   - Ban/unban users
   - Review abuse reports

3. **Audit Trail**
   - View all actions
   - Export logs

---

## 🔐 Security Features

### Authentication
- Google OAuth via Supabase Auth
- JWT tokens with automatic refresh
- Session validation on every request

### Data Protection
- AES-256-GCM encryption for security answers
- Image metadata (EXIF, GPS) stripped
- No personal info in public views

### Abuse Prevention
- Rate limiting per user/IP
- Claim limits (3 per item, 5 per day)
- Duplicate image detection
- Auto-ban on report threshold

### Audit & Compliance
- Complete audit trail
- IP logging
- GDPR-friendly data handling

---

## 📊 API Documentation

### Authentication

All protected endpoints require:
```
Authorization: Bearer <supabase-jwt-token>
```

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/health` | ❌ | Health check |
| **Users** |
| GET | `/api/v1/users/me` | ✅ | Get profile |
| PATCH | `/api/v1/users/me` | ✅ | Update profile |
| **Items** |
| GET | `/api/v1/items` | ❌ | List items |
| POST | `/api/v1/items` | ✅ | Create item |
| GET | `/api/v1/items/:id` | ❌ | Get item |
| PATCH | `/api/v1/items/:id` | ✅ | Update item |
| DELETE | `/api/v1/items/:id` | ✅ | Delete item |
| GET | `/api/v1/items/my` | ✅ | My items |
| **Claims** |
| GET | `/api/v1/claims` | ✅ | My claims |
| POST | `/api/v1/items/:id/claims` | ✅ | Submit claim |
| PATCH | `/api/v1/claims/:id/approve` | ✅ | Approve |
| PATCH | `/api/v1/claims/:id/reject` | ✅ | Reject |
| **Chats** |
| GET | `/api/v1/chats` | ✅ | My chats |
| GET | `/api/v1/chats/:id` | ✅ | Get chat |
| POST | `/api/v1/chats/:id/messages` | ✅ | Send message |
| **Reports** |
| POST | `/api/v1/reports` | ✅ | Submit report |
| **Admin** |
| GET | `/api/v1/admin/dashboard` | 🔒 | Statistics |
| GET | `/api/v1/admin/users` | 🔒 | All users |
| PATCH | `/api/v1/admin/users/:id/ban` | 🔒 | Ban user |

Legend: ❌ Public | ✅ Auth Required | 🔒 Admin Only

---

## 🚢 Deployment

### Frontend (Vercel)

1. Connect GitHub repository
2. Set environment variables:
   ```
   VITE_SUPABASE_URL=your-url
   VITE_SUPABASE_ANON_KEY=your-key
   VITE_API_URL=your-backend-url
   ```
3. Deploy

### Backend (Render)

1. Create new Web Service
2. Connect repository
3. Set:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables
5. Deploy

### Edge Functions (Supabase)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy verify-claim
supabase functions deploy detect-abuse
supabase functions deploy scheduled-cleanup
supabase functions deploy strip-image-metadata

# Set secrets
supabase secrets set ENCRYPTION_KEY=your-key
```

---

## 🧪 Testing

### Backend
```bash
cd backend
npm test
```

### Frontend
```bash
cd frontend
npm test
```

### Manual Testing Checklist
- [ ] User can sign in with Google
- [ ] User can report found item
- [ ] Item appears in browse
- [ ] User can submit claim
- [ ] Finder can approve/reject
- [ ] Chat opens on approval
- [ ] Item marked as returned
- [ ] Admin can ban users
- [ ] Rate limits work

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📄 License

MIT License

---

## 🙏 Acknowledgments

- Built for the people of Bangalore
- Powered by [Supabase](https://supabase.com)
- UI components from [Tailwind CSS](https://tailwindcss.com)
- Icons from [Lucide](https://lucide.dev)

---

<p align="center">
  Made with ❤️ for Bangalore
</p>

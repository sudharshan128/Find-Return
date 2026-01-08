# Admin Panel Documentation

## Overview

The Lost & Found Bangalore Admin Panel is a comprehensive, enterprise-grade administration system designed for complete oversight and control of the platform. It provides separate authentication, immutable audit logging, and role-based access control.

## Security Features

### Isolated Authentication
- Admin panel has completely separate authentication from public users
- Admin accounts are stored in a dedicated `admin_users` table
- No visible links from public site to admin panel
- Access via `/admin` URL only

### Role-Based Access Control (RBAC)
Three admin roles with hierarchical permissions:

| Role | Permissions |
|------|-------------|
| **super_admin** | Full platform control, settings management, hard delete, view all audit logs |
| **moderator** | User moderation, content review, claim handling, soft delete |
| **analyst** | Read-only access to all data and reports |

### Session Security
- Configurable session timeout (default: 30 minutes)
- Activity tracking with automatic session extension
- Login history logging with IP addresses
- Optional IP allowlist for admin access

### Audit Trail
- **Immutable logs**: Cannot be modified or deleted
- **Cryptographic checksums**: Each entry includes hash for tamper detection
- **Chain verification**: Each entry references previous entry's checksum
- **Comprehensive logging**: All admin actions recorded with context

## Access Points

### URLs
- **Admin Panel**: `/admin` or `/admin.html`
- **Admin Login**: `/admin/login`

### Development
```bash
# Start development server
npm run dev

# Access admin panel
http://localhost:5173/admin.html
```

### Production Build
```bash
npm run build
# Generates both main app and admin panel
```

## Database Schema

### New Tables

| Table | Purpose |
|-------|---------|
| `admin_users` | Admin accounts with roles |
| `admin_audit_logs` | Immutable action log |
| `admin_messages` | Admin-to-user communication |
| `user_restrictions` | Active user restrictions |
| `user_warnings` | Warning history |
| `trust_score_history` | Trust score changes |
| `claim_admin_notes` | Admin notes on claims |
| `item_moderation_log` | Item moderation history |
| `chat_moderation_log` | Chat moderation history |
| `system_settings` | Platform configuration |
| `admin_login_history` | Login tracking |
| `platform_statistics_daily` | Daily statistics |

### New Enums
- `admin_role`: super_admin, moderator, analyst
- `admin_action_type`: Various action types for audit logging
- `admin_message_context`: Context for admin messages
- `setting_type`: Configuration value types

## Admin Pages

### Dashboard (`/admin/dashboard`)
- Real-time platform statistics
- Alert cards for pending actions
- Area and category breakdowns
- Daily activity table
- System health status

### User Management (`/admin/users`)
- Searchable user list with filters
- User detail modal with tabs:
  - Overview (profile, trust score, status)
  - Items (user's posted items)
  - Claims (user's claim history)
  - Warnings (warning history)
  - Trust History (trust score changes)
- Moderation actions:
  - Warn user
  - Suspend user (temporary)
  - Ban user (permanent)
  - Adjust trust score
  - Disable chat
  - Block claims

### Item Moderation (`/admin/items`)
- Item listing with filters (status, flagged, hidden)
- Item detail modal with images and claims
- Moderation actions:
  - Hide item (temporary)
  - Unhide item
  - Soft delete (recoverable)
  - Restore deleted item
  - Hard delete (super_admin only)
  - Clear flag

### Claims Moderation (`/admin/claims`)
- Claims list with status filters
- Dispute handling workflow
- Moderation actions:
  - Lock claim
  - Unlock claim
  - Override approve
  - Override reject
  - Flag as disputed
  - Resolve dispute
  - Add admin notes

### Chat Moderation (`/admin/chats`)
- Chat list with freeze status
- **Privacy-protected message viewing**:
  - Requires written justification
  - All access is logged
  - Messages viewable only when justified
- Moderation actions:
  - Freeze chat (prevent new messages)
  - Unfreeze chat
  - Delete messages (super_admin)

### Abuse Reports (`/admin/reports`)
- Report queue with priority sorting
- Report types: user, item, chat, claim
- Severity levels: low, medium, high, critical
- Resolution workflow:
  - Review report details
  - Resolve with action taken
  - Dismiss if invalid
  - Escalate to super_admin

### Audit Logs (`/admin/audit-logs`)
- Searchable/filterable log viewer
- Admin and action type filters
- Date range filtering
- Log detail modal with:
  - Full action context
  - Target information
  - Integrity checksums
- Export functionality (super_admin)

### System Settings (`/admin/settings`)
- Tabbed interface:
  - **General**: Platform name, contact info, trust scores
  - **Security**: Session timeouts, login attempts, 2FA, IP allowlist
  - **Notifications**: Email/push settings, alert thresholds
  - **Limits & Quotas**: User limits, file sizes, expiry days
  - **Maintenance**: Maintenance mode, cleanup settings

## API Layer

The admin API is defined in `src/admin/lib/adminSupabase.js`:

```javascript
// Authentication
adminAuth.signIn(email, password)
adminAuth.signInWithGoogle()
adminAuth.signOut()
adminAuth.getSession()
adminAuth.getCurrentAdmin()

// Dashboard
adminDashboard.getStats()
adminDashboard.getAlerts()
adminDashboard.getDailyActivity(days)

// User Management
adminUsers.getAll(filters)
adminUsers.getById(userId)
adminUsers.warn(userId, reason, severity)
adminUsers.suspend(userId, reason, durationDays)
adminUsers.ban(userId, reason)
adminUsers.unban(userId, reason)
adminUsers.adjustTrustScore(userId, adjustment, reason)

// Item Moderation
adminItems.getAll(filters)
adminItems.hideItem(itemId, reason)
adminItems.unhideItem(itemId, adminId, reason)
adminItems.softDeleteItem(itemId, adminId, reason)
adminItems.hardDeleteItem(itemId, adminId, reason)
adminItems.restoreItem(itemId, adminId, reason)

// Claims
adminClaims.getAll(filters)
adminClaims.lockClaim(claimId, adminId, reason)
adminClaims.unlockClaim(claimId, adminId, reason)
adminClaims.overrideClaim(claimId, status, adminId, reason)
adminClaims.addNote(claimId, adminId, note)

// Chats
adminChats.getAll(filters)
adminChats.logAccess(chatId, adminId, justification)
adminChats.freezeChat(chatId, adminId, reason)
adminChats.unfreezeChat(chatId, adminId, reason)
adminChats.deleteMessage(messageId, adminId, reason)

// Reports
adminReports.getAll(filters)
adminReports.resolveReport(reportId, adminId, resolution)
adminReports.dismissReport(reportId, adminId, reason)
adminReports.escalateReport(reportId, adminId, reason)

// Settings
adminSettings.getAll()
adminSettings.update(key, value)
adminSettings.updateMultiple(settings)

// Audit Logs
adminAuditLogs.getAll(filters)
adminAuditLogs.export(filters)
```

## SQL Setup

Run these files in order in Supabase SQL Editor:

1. `supabase/admin_schema.sql` - Creates all tables, enums, functions
2. `supabase/admin_rls.sql` - Sets up Row Level Security policies

## Creating First Admin

After running the SQL files, create the first super_admin:

```sql
-- Insert a super admin (use actual user ID from auth.users)
INSERT INTO admin_users (id, email, full_name, role)
VALUES (
  'your-supabase-user-uuid',
  'admin@example.com',
  'Super Admin',
  'super_admin'
);
```

## Security Best Practices

1. **Never share admin URLs** publicly
2. **Use strong passwords** and enable 2FA when available
3. **Review audit logs** regularly
4. **Set up IP allowlists** for production
5. **Configure session timeouts** appropriately
6. **Train moderators** on privacy-respecting access

## Compliance Features

- GDPR-compliant data access logging
- Right to explanation (audit trail)
- Data retention configuration
- Export capabilities for compliance requests
- Privacy-first chat access (justification required)

## Troubleshooting

### Admin can't log in
1. Check if user exists in `admin_users` table
2. Verify user's auth.users account exists
3. Check if account is active (`is_active = true`)
4. Review `admin_login_history` for failed attempts

### RLS policy errors
1. Ensure all SQL files were run
2. Check `is_admin()` function returns correctly
3. Verify admin session token is being passed

### Audit logs not appearing
1. Check `log_admin_action()` function exists
2. Verify admin_id is being passed to actions
3. Review PostgreSQL logs for errors

## File Structure

```
frontend/src/admin/
├── AdminApp.jsx              # Main admin application
├── index.js                  # Module exports
├── admin-main.jsx            # Entry point
├── contexts/
│   └── AdminAuthContext.jsx  # Auth state management
├── components/
│   └── AdminLayout.jsx       # Layout with sidebar
├── lib/
│   └── adminSupabase.js      # API layer
└── pages/
    ├── AdminLoginPage.jsx
    ├── AdminDashboardPage.jsx
    ├── AdminUsersPage.jsx
    ├── AdminItemsPage.jsx
    ├── AdminClaimsPage.jsx
    ├── AdminChatsPage.jsx
    ├── AdminReportsPage.jsx
    ├── AdminAuditLogsPage.jsx
    └── AdminSettingsPage.jsx
```

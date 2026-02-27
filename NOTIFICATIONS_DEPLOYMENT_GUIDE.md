# Notifications System Deployment Guide

## 1. Run Database Migration

You need to execute the notifications SQL file in your Supabase dashboard.

### Steps:

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/yrdjpuvmijibfilrycnu
2. Go to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire content from `sql/notifications.sql`
5. Paste it into the SQL editor
6. Click **Run** to execute

This will create:
- ✅ `notifications` table with all necessary columns
- ✅ Notification type enum
- ✅ Auto-notification triggers for:
  - New user registrations
  - Membership approvals/rejections
  - Item reports
  - Claim submissions/approvals/rejections
  - Abuse reports
  - User bans
- ✅ Helper functions for managing notifications
- ✅ RLS policies for security

## 2. Verify Backend is Running

The backend should already be running with the new routes. If not:

```powershell
cd "d:\Dream project\Return\backend\nodejs"
npm run dev
```

## 3. Test the Notification System

### Option A: Create a Test Notification (Super Admin Only)

```bash
# Using PowerShell
$token = "YOUR_ADMIN_TOKEN"
$body = @{
    type = "system_alert"
    title = "Test Notification"
    message = "This is a test notification from the admin panel"
    priority = 3
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/admin/notifications/test" `
    -Method POST `
    -Headers @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"} `
    -Body $body
```

### Option B: Trigger Automatic Notifications

The system will automatically create notifications when:

1. **New User Registers** - A notification will be sent to all admins
2. **User Membership Approved** - Notification to super admins
3. **User Membership Rejected** - Notification to super admins
4. **New Item Reported** - Notification to all admins
5. **Claim Submitted** - Notification to all admins (high priority)
6. **Claim Approved/Rejected** - Notification to moderators
7. **Abuse Report Created** - Notification to moderators (high priority)
8. **User Banned** - Notification to super admins

## 4. Access Notifications in Admin Panel

1. Navigate to http://localhost:5173/admin
2. Login with your admin credentials
3. Click on **Notifications** in the sidebar
4. Or click the bell icon in the header

## 5. Features Available

### Notifications Page
- ✅ View all notifications
- ✅ Filter by read/unread status
- ✅ Filter by notification type
- ✅ Mark individual notifications as read
- ✅ Mark all notifications as read
- ✅ Delete individual notifications
- ✅ Auto-refresh every 30 seconds
- ✅ Priority badges (Low, Medium, High, Urgent)
- ✅ Color-coded notifications by type
- ✅ Statistics dashboard

### Header Notification Bell
- ✅ Real-time unread count
- ✅ Click to navigate to notifications page
- ✅ Auto-updates every 30 seconds

### Sidebar
- ✅ Notifications menu item with unread badge
- ✅ Direct access to notifications page

## 6. API Endpoints

All endpoints require admin authentication:

- `GET /api/admin/notifications` - Get all notifications
- `GET /api/admin/notifications/unread-count` - Get unread count
- `GET /api/admin/notifications/:id` - Get specific notification
- `PUT /api/admin/notifications/:id/read` - Mark as read
- `PUT /api/admin/notifications/read-all` - Mark all as read
- `DELETE /api/admin/notifications/:id` - Delete notification
- `POST /api/admin/notifications/test` - Create test notification (super admin only)
- `GET /api/admin/notifications/stats/summary` - Get notification statistics

## 7. Database Functions

Available PostgreSQL functions:

- `create_notification()` - Create a new notification
- `mark_notification_read(notification_id)` - Mark notification as read
- `mark_all_notifications_read()` - Mark all as read for current user
- `cleanup_old_notifications(days_old)` - Delete old read notifications

## 8. Notification Types

- `user_registered` - New user signs up
- `membership_approved` - User membership approved
- `membership_rejected` - User membership rejected
- `item_reported` - New item reported
- `claim_submitted` - New claim submitted
- `claim_approved` - Claim approved
- `claim_rejected` - Claim rejected
- `abuse_report` - Abuse report filed
- `user_banned` - User account banned
- `chat_flagged` - Chat flagged for review
- `system_alert` - System alerts

## 9. Troubleshooting

### No Notifications Appearing

1. Check database: Ensure the notifications table exists
   ```sql
   SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;
   ```

2. Check triggers: Ensure triggers are installed
   ```sql
   SELECT trigger_name, event_object_table, action_statement
   FROM information_schema.triggers
   WHERE trigger_name LIKE '%notify%';
   ```

3. Check backend logs for errors

### Unread Count Not Updating

- Wait 30 seconds for auto-refresh
- Manually refresh the page
- Check browser console for errors
- Verify admin_token is valid

## 10. Cleanup

To clean up old read notifications (keeps database lean):

```sql
SELECT cleanup_old_notifications(30); -- Delete notifications read more than 30 days ago
```

You can schedule this to run periodically using Supabase Database Webhooks or cron jobs.

## Deployment Complete! 🎉

The notification system is now fully functional with:
- ✅ Real-time notifications for all admin actions
- ✅ Auto-triggered notifications for user events
- ✅ Beautiful UI with filtering and statistics
- ✅ Secure RLS policies
- ✅ Performance-optimized with indexes

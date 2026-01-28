# Settings Testing Guide

## ✅ What's Now Working

### Backend Changes:
1. **Settings Middleware Created** - Enforces system settings
2. **Maintenance Mode Enforcement** - Blocks non-admin API calls when enabled
3. **Settings Cache** - 30-second cache with auto-refresh
4. **Cache Clear on Save** - Changes take effect immediately after saving

### How to Test Settings:

## 🧪 Test 1: Save Settings (Should work now)

1. Go to http://localhost:5173/admin/settings
2. Click any tab (General, Security, etc.)
3. Change a value (e.g., toggle "Enable Public Registration")
4. **Watch for yellow highlight** on the changed field
5. **Click "Save Changes"** button at the top
6. Should see green toast: "Settings saved successfully"
7. Check Audit Logs - should show UPDATE_SETTINGS entry

## 🧪 Test 2: Maintenance Mode

1. Go to Settings → General tab
2. Toggle "Maintenance Mode" to ON
3. Click "Save Changes"
4. Open a new browser window (incognito/private mode)
5. Try to access http://localhost:3000/api/health
   - **Admin should still work**: http://localhost:5173/admin
   - **Regular API should return 503**: All non-admin endpoints blocked

To check maintenance mode:
```bash
# This should return 503 with maintenance message
curl http://localhost:3000/api/users

# This should still work (admin bypass)
curl http://localhost:3000/api/admin/dashboard -H "Authorization: Bearer YOUR_TOKEN"
```

## 🧪 Test 3: Registration Setting

1. Toggle "Enable Public Registration" to OFF
2. Save
3. Any registration endpoint will now return 403
   - Note: You'll need to add registration routes to test this fully

## 🔍 Debugging If Save Button Doesn't Work

**Check Browser Console:**
1. Press F12 → Console tab
2. Try to save a setting
3. Look for errors:
   - Network errors (red)
   - API call responses
   - JavaScript errors

**Check Network Tab:**
1. F12 → Network tab
2. Click Save Changes
3. Look for PUT request to `/api/admin/settings`
4. Check if it's:
   - Status 200 = Success
   - Status 401 = Not authorized
   - Status 403 = Not super admin
   - Status 500 = Server error

**Common Issues:**

### Issue: Save button grayed out
- **Cause**: No changes made
- **Fix**: Modify a value first (watch for yellow highlight)

### Issue: "Failed to save settings" toast
- **Cause**: API error or authentication issue
- **Check**:
  1. Backend running on port 3000?
  2. Still logged in as super admin?
  3. Check browser console for error details

### Issue: No yellow highlight when changing values
- **Cause**: Frontend not detecting changes
- **Check**: The `handleSettingChange` function in AdminSettingsPage.jsx

### Issue: Save succeeds but changes don't persist
- **Cause**: Database update failing silently
- **Check**: 
  1. Supabase connection working?
  2. Check backend logs for errors
  3. Verify setting_key matches database

## 📊 Verify Settings Are Applied

After saving, verify changes took effect:

```sql
-- Run in Supabase SQL Editor
SELECT 
  setting_key,
  setting_value,
  setting_type,
  updated_at
FROM system_settings
WHERE setting_key IN ('maintenance_mode', 'enable_registration')
ORDER BY updated_at DESC;
```

## 🎯 Current Feature Status

### ✅ Fully Working:
- Settings page loads all 26 settings
- All 5 tabs functional
- Toggle switches work
- Number inputs work
- Text inputs work
- Yellow highlight on modification
- Refresh button reloads settings

### ⚠️ To Verify:
- **Save button** - Click and check for success toast
- **Maintenance mode enforcement** - Toggle on and test API access
- **Audit logging** - Check logs after save
- **Cache clearing** - Changes should be immediate

### 📝 Settings That Need Additional Implementation:
- **Email notifications** - Requires email service
- **Push notifications** - Requires service worker
- **2FA enable** - Already implemented in auth flow
- **Session timeouts** - Needs client-side timeout monitoring
- **IP allowlist** - Needs IP checking middleware
- **Auto cleanup** - Needs scheduled cron job

## 🚀 Next Steps

1. **Test Save Button** - Try saving a setting and report any errors
2. **Test Maintenance Mode** - Enable it and verify it blocks non-admin access
3. **Check Audit Logs** - Verify UPDATE_SETTINGS entries appear
4. **Report Issues** - Share any error messages from browser console

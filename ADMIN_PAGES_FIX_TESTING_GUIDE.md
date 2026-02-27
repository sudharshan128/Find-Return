# Admin Pages Fix - Testing Guide

## Quick Verification Steps

### 1. Admin Login Test
```
1. Navigate to /admin/login
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Should redirect to admin dashboard (not white screen)
```

### 2. Dashboard Test
```
Expected Results:
✓ Page loads (no white screen)
✓ Shows "Total Items", "Active Claims", "Users Online"
✓ Shows "14-Day Trend" chart
✓ Shows "Items by Area" and "Items by Category" charts
✓ All data populated (not blank)
```

### 3. Admin Items Page
```
Expected Results:
✓ Page loads list of items
✓ Shows item count and pagination
✓ Can search items
✓ Can filter by status, flagged, hidden
✓ Can click item to view details
✓ Can perform actions (flag, hide, delete)
```

### 4. Admin Users Page
```
Expected Results:
✓ Page loads list of users
✓ Shows user count and pagination
✓ Can search users
✓ Can filter by status and trust score
✓ Can view user details
✓ Can perform actions (ban, reset trust score)
```

### 5. Admin Claims Page
```
Expected Results:
✓ Page loads list of claims
✓ Can filter by status, locked, disputed
✓ Can view claim details
✓ Can approve or reject claims
✓ Can add review notes
```

### 6. Admin Chats Page
```
Expected Results:
✓ Page loads list of chats
✓ Can request access with justification
✓ Should open dialog for access justification
✓ Can view chat messages after access granted
✓ Can close conversations
✓ Can delete messages
```

### 7. Admin Reports Page
```
Expected Results:
✓ Page loads list of abuse reports
✓ Can filter by status and type
✓ Can view report details
✓ Can resolve or take action on reports
```

### 8. Admin Audit Logs Page
```
Expected Results:
✓ Page loads audit log entries
✓ Can filter by action, admin, and date
✓ Shows all admin actions logged
✓ Can export logs
```

### 9. Admin Settings Page
```
Expected Results:
✓ Page loads system settings
✓ Can edit settings
✓ Can save changes
✓ Changes persist on reload
```

## Error Checking

### Browser Console
```
Open DevTools (F12) → Console tab
✓ No red errors
✓ No "401 Unauthorized" messages
✓ No "Network failed" messages
✓ Check for actual error objects if pages fail to load
```

### Network Tab
```
Open DevTools (F12) → Network tab
Expected Requests:
✓ POST /api/admin/auth/verify (for login)
✓ GET /api/admin/analytics/summary (for dashboard)
✓ GET /api/admin/items?page=1&limit=10 (for items)
✓ GET /api/admin/users?page=1&limit=10 (for users)
✓ GET /api/admin/claims?page=1&limit=10 (for claims)
✓ GET /api/admin/chats?page=1&limit=10 (for chats)
✓ GET /api/admin/reports?page=1&limit=10 (for reports)
✓ GET /api/admin/audit-logs?page=1&limit=10 (for audit logs)
✓ GET /api/admin/settings (for settings)

All requests should have:
- Status 200 (success)
- Response with actual data
- Authorization header: "Bearer {access_token}"
```

## Failure Diagnostics

### White Screen Issues
```
If admin page shows white screen:

1. Open browser DevTools (F12)
2. Check Console for JavaScript errors
3. Check Network tab:
   - Is there a failed API request? (400, 401, 500)
   - Did request timeout? (no response)
   - Was response empty?
4. Check if backend is running
5. Verify API_BASE_URL in frontend .env.local
6. Check Authorization header is being sent
```

### "Failed to load [page]" Error
```
This is normal error handling and means:
- Backend returned error (400/401/500)
- Network call failed
- Data parsing failed

Check:
1. Is backend running?
2. Is admin logged in and token valid?
3. Are required admin privileges in place?
4. Is 2FA required but not set up?
```

### Blank Page (But No Error)
```
If page appears but no data shown:

1. Check if data is actually being fetched (Network tab)
2. Check if response has data in it
3. If response is empty [], data might be correctly fetched but no items exist
4. Check console for any warnings
5. Look for loading state lasting too long (possible infinite loop)
```

## Performance Validation

### Expected Load Times
- Dashboard: 1-2 seconds
- Items page: 1-2 seconds
- Users page: 1-2 seconds
- Other pages: 1-2 seconds

If significantly slower, check:
- Network latency (Network tab)
- Backend performance
- Database query performance

## Public Pages Validation

Verify public functionality still works:
```
✓ Non-logged-in users can see public items
✓ Can search and filter items
✓ Can sign up
✓ Can sign in as regular user
✓ Can submit lost/found items
✓ Can browse profiles
✓ Can initiate chats
```

## Rollback Plan

If admin pages fail after fix:
1. Revert changes to admin pages (imports and API calls)
2. OR disable admin section temporarily
3. Check backend logs for errors
4. Verify backend endpoints are returning proper responses
5. Check authentication flow

## Success Criteria

Fix is successful when:
- ✅ All admin pages load without white screens
- ✅ All pages display data (not blank)
- ✅ API requests show proper Authorization header
- ✅ No JavaScript errors in console
- ✅ Public pages still work normally
- ✅ Admin logout works correctly
- ✅ Error handling shows appropriate toasts
- ✅ Admin actions logged in audit logs

## Common Issues & Solutions

### Issue: 401 Unauthorized
**Solution**: 
- Check if token is expired
- Log out and log in again
- Verify OAuth credentials are correct

### Issue: 404 Not Found (API)
**Solution**:
- Verify backend is running
- Check API_BASE_URL environment variable
- Ensure backend endpoints exist

### Issue: Empty responses
**Solution**:
- Check if data exists in database
- Verify admin has proper permissions
- Check RLS policies on backend

### Issue: 2FA required
**Solution**:
- Set up 2FA if prompted
- Follow 2FA verification flow
- Contact admin if 2FA reset needed

## Additional Notes

- All changes are in frontend only
- No backend code changes needed
- API client handles all endpoint calls
- Error handling preserved throughout
- Loading states intact
- Security enhanced through proper token handling

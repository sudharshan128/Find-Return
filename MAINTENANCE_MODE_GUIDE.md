# Maintenance Mode Implementation Guide

## Current Status: ✅ Backend Working, ⚠️ Frontend Needs UI

### What's Already Working:

1. **Admin Toggle**: Maintenance mode can be enabled/disabled in `/admin/settings`
2. **Backend Enforcement**: Middleware blocks all non-admin API requests
3. **API Response**: Returns 503 with maintenance message

### What Users Currently See:

When maintenance mode is ON, users making API requests get:
```json
{
  "error": "Service temporarily unavailable",
  "message": "We are currently performing maintenance. Please check back soon.",
  "maintenance": true,
  "code": "MAINTENANCE_MODE"
}
```

### What Needs to Be Added:

#### Frontend Maintenance Page

**File to create**: `frontend/src/pages/MaintenancePage.jsx`

```jsx
import { Wrench, Clock } from 'lucide-react';

const MaintenancePage = ({ message }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-4">
            <Wrench className="h-10 w-10 text-indigo-600 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Under Maintenance
          </h1>
          <p className="text-gray-600 mb-6">
            {message || 'We are currently performing maintenance. Please check back soon.'}
          </p>
        </div>
        
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>Estimated time: 15-30 minutes</span>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            For urgent matters, please contact support
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
```

#### API Interceptor

**Update**: `frontend/src/lib/apiClient.js` or create axios interceptor

```javascript
// Add to your API client
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 503 && error.response?.data?.maintenance) {
      // Redirect to maintenance page or show modal
      window.location.href = '/maintenance';
    }
    return Promise.reject(error);
  }
);
```

### Testing Maintenance Mode:

1. **Enable in Admin**:
   - Go to http://localhost:5174/admin/settings
   - Toggle "Maintenance Mode" ON
   - Click "Save Changes"

2. **Test User Experience**:
   ```bash
   # Test API endpoint (should return 503)
   curl http://localhost:3000/api/items
   
   # Admin endpoints still work
   curl http://localhost:3000/api/admin/auth/profile
   ```

3. **Verify**:
   - ✅ Admin panel should work normally
   - ✅ User pages/API should show maintenance message
   - ✅ Health check should pass: `curl http://localhost:3000/api/health`

### Customization:

**Maintenance Message** (in settings):
- Go to `/admin/settings` → General tab
- Edit "Maintenance Message" field
- This message is shown to users during maintenance

### How It Protects Your System:

1. **Prevents New User Actions**: No registrations, item posts, claims while you fix issues
2. **Admins Keep Access**: You can monitor, fix data, adjust settings
3. **Graceful Degradation**: Shows friendly message instead of broken features
4. **Quick Toggle**: Turn on/off instantly without code deploy

### Emergency Disable:

If you need to disable maintenance mode directly in database:

```sql
UPDATE system_settings 
SET setting_value = 'false'
WHERE setting_key = 'maintenance_mode';
```

Then restart backend or wait 30 seconds for cache refresh.

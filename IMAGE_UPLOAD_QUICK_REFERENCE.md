# IMAGE UPLOAD - QUICK REFERENCE CARD

## BUCKET INFORMATION

```
Bucket Name:    item-images
Location:       Supabase Storage (yrdjpuvmijibfilrycnu.supabase.co)
Public/Private: PUBLIC (anyone can view files)
File Size:      Max 5 MB per file
File Types:     JPEG, PNG, WebP, GIF only
Path Format:    {user_id}/{timestamp}-{random}.{ext}
```

## QUICK VERIFICATION

### Test Page URL
```
http://localhost:5173/test-image-upload
(Must be logged in)
```

### What the test does:
1. Creates dummy PNG image in memory
2. Uploads to Supabase Storage bucket "item-images"
3. Generates public URL
4. Creates test item in database
5. Links image to item in item_images table
6. Returns test item URL

### Expected Results:
✅ Test should complete in 5-10 seconds  
✅ All stages should show "✅ PASSED"  
✅ Test item visible at: http://localhost:5173/items/{item_id}  
✅ Image should display on homepage  
✅ Image should display on item detail page

---

## DATABASE TABLE

### item_images

```
Column          | Type      | Purpose
─────────────────────────────────────────────────────
id              | UUID      | Unique image ID
item_id         | UUID      | Links to item (FK)
storage_bucket  | TEXT      | 'item-images'
storage_path    | TEXT      | Path in bucket
image_url       | TEXT      | Full public URL ⭐
is_primary      | BOOLEAN   | First image?
sort_order      | INTEGER   | Gallery order
created_at      | TIMESTAMP | Auto timestamp
```

⭐ = **image_url is the public URL retrieved from Supabase Storage**

---

## UPLOAD FLOW

```
User selects file
         ↓
File validation (type, size)
         ↓
Upload to Supabase Storage
    ├─ Bucket: item-images
    ├─ Path: {user_id}/{timestamp}-{random}.{ext}
    └─ Returns: Public URL
         ↓
Save to item_images table
    ├─ image_url: Public URL (stored)
    ├─ storage_path: Relative path
    ├─ is_primary: true/false
    └─ sort_order: index
         ↓
Image appears on:
    ├─ Homepage (primary image in card)
    ├─ Item detail page (gallery view)
    └─ Admin panel (list & detail)
```

---

## FILE LOCATIONS

### Configuration
- Supabase bucket SQL: `supabase/storage_policies.sql:16-26`
- RLS policies: `supabase/storage_policies.sql:74-130`
- Database schema: `supabase/schema.sql:307-327`

### Upload Function
- Location: `frontend/src/lib/supabase.js:1016-1100`
- Validation: Lines 1028-1035
- Upload: Lines 1043-1057
- Public URL: Lines 1090-1100

### Item Creation
- Location: `frontend/src/lib/supabase.js:199-283`
- Item insert: Lines 218-231
- Image insert: Lines 236-276

### Image Display
- getImageUrl(): `frontend/src/lib/supabase.js:34-50`
- getPrimaryImageUrl(): `frontend/src/lib/supabase.js:52-60`
- Homepage display: `frontend/src/pages/HomePage.jsx`
- Item detail: `frontend/src/pages/ItemDetailPage.jsx`
- Admin display: `frontend/src/admin/pages/AdminItemsPage.jsx`

### Test Files (New)
- Test utility: `frontend/src/lib/imageUploadTest.js`
- Test page: `frontend/src/pages/ImageUploadTestPage.jsx`
- Route added: `frontend/src/App.jsx` (line +3)

---

## CONSOLE LOGS TO WATCH FOR

### Success Logs (Good)
```
[storage.uploadItemImage] Starting upload for: filename.png
[storage.uploadItemImage] Upload successful, path: user_id/timestamp-random.png
[storage.uploadItemImage] Public URL: https://...
[db.items.create] Item created successfully with ID: ...
[db.items.create] Images saved successfully
```

### Error Logs (Bad)
```
❌ [storage.uploadItemImage] Storage upload error
❌ [storage.uploadItemImage] No path in response
❌ [db.items.create] Failed to insert item images
❌ CORS error
❌ 403 Forbidden
❌ 401 Unauthorized
```

---

## TROUBLESHOOTING

| Problem | Cause | Fix |
|---------|-------|-----|
| "Bucket not found" | Storage bucket not created | Run supabase/storage_policies.sql in Supabase |
| "Upload policy error" | User ID missing or wrong | Login and retry |
| "File too large" | File > 5MB | Use smaller image |
| "Invalid file type" | Not JPEG/PNG/WebP/GIF | Convert to allowed format |
| Image not on homepage | Image records not inserted | Check console for DB errors |
| Admin can't see images | Admin API not configured | Verify JWT token setup |
| White screen | Error not handled | Check console for JS errors |

---

## SECURITY CHECKLIST

✅ **Authentication**
- Login required to upload
- ProtectedRoute wrapper on /upload-item
- userId checked before upload

✅ **File Validation**
- File type checked (image/* only)
- File size checked (5MB limit)
- Validated client-side and server-side

✅ **Storage Security**
- RLS policy: Only your folder visible
- Path format: {user_id}/{...} enforces isolation
- Public URL only: No private paths stored

✅ **Database Security**
- JWT required for admin access
- Service role key for backend only
- RLS policies enforce access control

✅ **Error Handling**
- No sensitive errors leaked
- User-friendly error messages
- Timeout protection on uploads

---

## API ENDPOINTS (Backend)

### Public (Anon Key)
```
GET /api/items              - List items with images
GET /api/items/{id}         - Get item with images
GET /api/items/{id}/claims  - Get claims
```

### Admin (JWT Required)
```
GET /api/admin/items        - List all items (with images)
POST /api/admin/items/{id}/hide - Hide item
POST /api/admin/items/{id}/unhide - Unhide item
POST /api/admin/audit-logs  - View actions
```

---

## DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] Run full image upload test
- [ ] Real image upload works
- [ ] Image appears on homepage
- [ ] Image appears on item detail
- [ ] Image appears on admin panel
- [ ] Upload fails gracefully when not logged in
- [ ] File validation works (reject > 5MB)
- [ ] File validation works (reject non-image)
- [ ] No console errors
- [ ] No white screens on error
- [ ] Admin can view images

---

## HELPFUL COMMANDS

### Test Upload Page
```
http://localhost:5173/test-image-upload
```

### View Test Item
```
http://localhost:5173/items/{test_item_id}
```

### Backend Health Check
```bash
curl http://localhost:3000/health
```

### View Database Console
```
https://yrdjpuvmijibfilrycnu.supabase.co
SQL Editor → Run queries
```

### View Storage Console
```
https://yrdjpuvmijibfilrycnu.supabase.co/project/[project_id]
Storage → item-images bucket
```

---

## CONTACT & SUPPORT

**Issues**:
- Check IMAGE_UPLOAD_VERIFICATION_GUIDE.md for detailed troubleshooting
- Check IMAGE_UPLOAD_IMPLEMENTATION_REPORT.md for architecture details
- Check browser console (F12 → Console) for error logs

**Test Results**:
- Expected: All tests pass ✅
- Success: Test item appears on all pages ✅
- Ready: Deploy to production 🟢

---

**Last Updated**: January 9, 2026  
**Status**: ✅ Ready for Testing  
**Version**: 1.0

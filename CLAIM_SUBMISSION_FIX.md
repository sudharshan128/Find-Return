# Claim Submission Fix - January 11, 2026

## Issues Fixed

### 1. ✅ Wrong Database Column Names
**Problem**: ClaimForm was trying to insert data with an `answers` object, but the `claims` table doesn't have this column.

**Error**:
```
Could not find the 'answers' column of 'claims' in the schema cache
```

**Fixed**: Changed ClaimForm to use correct column names:
- `description` ← unique marks from user
- `contact_info` ← email address
- `proof_description` ← how they lost it + contents
- `proof_images` ← array of uploaded image URLs
- `security_answer_encrypted` ← will be encrypted by backend

**Files Modified**:
- `frontend/src/components/claims/ClaimForm.jsx`

---

### 2. ⚠️ Storage RLS Policy Violation
**Problem**: Upload to `item-images` bucket fails with "new row violates row-level security policy"

**Error**:
```
StorageApiError: new row violates row-level security policy
```

**Cause**: The `item-images` bucket has a restrictive RLS policy that only allows certain users to upload to it.

**Solution Required**: Fix Supabase Storage bucket settings

---

## Required Action: Configure Supabase Storage RLS

### Step 1: Go to Supabase Dashboard
1. Open: https://app.supabase.com
2. Select your project (trust-found or Lost & Found Bangalore)
3. Go to **Storage** (left sidebar)

### Step 2: Edit `item-images` Bucket Policy
1. Click on **item-images** bucket
2. Click the three-dot menu (⋯)
3. Select **Edit Policies**

### Step 3: Configure Upload Permissions
The bucket should allow:
- ✅ **Everyone** to upload to their own folder (authenticated)
- ✅ **Everyone** to read public images (for display)
- ⛔ **Only admin** to delete

**Current issue**: The upload RLS is too restrictive

### Step 4: Add/Modify Policy
Make sure you have this policy for uploads:

```sql
-- Allow authenticated users to upload to item-images bucket
-- in their own user ID folder and claims subfolder
CREATE POLICY "Allow authenticated upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-images' AND
  (
    -- Allow upload to items/{user_id}/ folder
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Allow upload to claims/{user_id}/ folder
    (
      (storage.foldername(name))[1] = 'claims' AND
      auth.uid()::text = (storage.foldername(name))[2]
    )
    OR
    -- Allow upload to avatars/{user_id}/ folder
    (
      (storage.foldername(name))[1] = 'avatars' AND
      auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);
```

### Step 5: Verify Read Permissions
Make sure this exists:

```sql
-- Allow everyone to read images
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'item-images');
```

### Step 6: Test
1. Refresh browser
2. Try claiming an item
3. Add images
4. Submit - should work now ✅

---

## What Data is Sent When Submitting Claim

When user clicks "Submit Claim" button:

```javascript
{
  item_id: "fab4f5c0-9ec7-49b4-8d35-2dc453615745",  // Item being claimed
  claimant_id: "f0f76964-29de-4270-9d5a-acced20cff96", // User claiming
  status: "pending",
  description: "Has a small scratch on the back",  // Unique marks
  contact_info: "sudharshancse123@gmail.com",  // Email
  security_answer_encrypted: "pending_verification",  // Placeholder
  proof_description: "Lost it on Tuesday morning bus...", // Loss details
  proof_images: [
    "https://...item-images/claims/f0f76964.../image1.jpg",  // URLs
    "https://...item-images/claims/f0f76964.../image2.jpg"
  ]
}
```

---

## Console Logs to Watch For

**Success**:
```
[ClaimForm] Creating claim with data: {...}
[storage.uploadClaimImage] Upload successful, path: claims/f0f76964.../...
[ClaimForm] Claim created successfully: {id: '...'}
```

**Failure (Storage)**:
```
[storage.uploadClaimImage] Upload error: StorageApiError: new row violates row-level security policy
```

**Failure (Database)**:
```
Error submitting claim: {code: 'PGRST204', message: "Could not find the 'answers' column..."}
```

---

## Next Steps

1. ✅ Code fixed - ClaimForm now uses correct columns
2. ⏳ Need to fix Supabase Storage RLS policy
3. Then test claim submission again

Once storage RLS is fixed, claim submissions will work end-to-end!


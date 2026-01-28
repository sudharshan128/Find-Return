# Claim Approval & Rejection Flow

## Overview
When a finder receives a claim request, they can approve or reject it using buttons on the **Item Claims Page**. Here's how the complete flow works:

---

## Step-by-Step Workflow

### 1. **Claim Request Received**
- User (claimant) submits a claim on an item
- Claim is created in the `claims` table with status: `pending`
- Finder (item owner) sees the claim in their **"View Claims"** page

### 2. **Finder Reviews Claim**
- Finder goes to `/items/{itemId}/claims`
- Sees all pending claims with claimant details:
  - Claimant's name & trust score
  - When the claim was submitted
  - Approve & Reject buttons

### 3. **Finder Clicks Approve/Reject Button**

#### **Flow for "Approve" Button:**
```
1. Click "Approve" → handleUpdateStatus(claimId, 'approved')
   ↓
2. Update Database
   - status: 'approved'
   - approved_at: current timestamp
   ↓
3. Create Chat (optional)
   - Auto-creates a chat between finder & claimant
   - Allows them to communicate about the item
   ↓
4. Update Item Status
   - Changes item status from 'active' to 'pending'
   - Prevents other users from claiming it
   ↓
5. Show Success Message
   - "Claim approved! A chat has been created with the claimant."
   ↓
6. Update UI
   - Removes claim from pending list
   - Shows updated status
```

#### **Flow for "Reject" Button:**
```
1. Click "Reject" → handleUpdateStatus(claimId, 'rejected')
   ↓
2. Update Database
   - status: 'rejected'
   - rejected_at: current timestamp
   ↓
3. Show Success Message
   - "Claim rejected"
   ↓
4. Update UI
   - Removes claim from pending list
   - Shows updated status
   - Item remains 'active' (open for other claims)
```

---

## Database Changes

### Claims Table Update
```sql
UPDATE claims 
SET 
  status = 'approved' | 'rejected',
  approved_at = NOW(),  -- if approved
  rejected_at = NOW()   -- if rejected
WHERE id = claimId
```

### Items Table Update (if Approved)
```sql
UPDATE items 
SET status = 'pending'
WHERE id = itemId
```

---

## Code Flow

### 1. **ItemClaimsPage.jsx** (Lines 78-113)
```javascript
const handleUpdateStatus = async (claimId, status) => {
  // 1. Call database function to update claim
  await db.claims.updateStatus(claimId, status);
  
  // 2. Update local state immediately
  setClaims(prev => prev.map(c => 
    c.id === claimId ? { ...c, status, reviewed_at: ... } : c
  ));
  
  // 3. If approved, create chat & update item
  if (status === 'approved') {
    await db.chats.getOrCreate(...);
    await db.items.update(id, { status: 'pending' });
  }
};
```

### 2. **supabase.js** (Lines 584-600)
```javascript
updateStatus: async (claimId, status) => {
  // Prepare updates
  const updates = { 
    status,
    approved_at: status === 'approved' ? NOW() : undefined,
    rejected_at: status === 'rejected' ? NOW() : undefined
  };
  
  // Execute database UPDATE
  await supabase
    .from('claims')
    .update(updates)
    .eq('id', claimId)
    .select()
    .single();
};
```

### 3. **RLS Policy Protection** (rls.sql - Lines 340-350)
```sql
CREATE POLICY "claims_update_finder"
  ON public.claims FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.items 
      WHERE id = claims.item_id 
      AND finder_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('approved', 'rejected')
  );
```

**This means:**
- ✅ Only the item owner (finder) can update claims
- ✅ Only pending claims can be updated
- ✅ Status can only be changed to 'approved' or 'rejected'
- ✅ Cannot change to any other status

---

## What Happens After Approval?

### For the Finder:
1. ✅ Chat is created with the claimant
2. ✅ Item status changes to 'pending'
3. ✅ Can now communicate with claimant in the chat

### For the Claimant:
1. ✅ Claim status shows as 'approved'
2. ✅ Can see the chat that was created
3. ✅ Can message the finder to arrange handover

### For Other Users:
1. ❌ Cannot see the item in "Browse Items" (status is no longer 'active')
2. ❌ Cannot submit new claims on this item

---

## What Happens After Rejection?

### For the Finder:
1. ✅ Claim status changes to 'rejected'
2. ✅ Item remains 'active' (open for other claims)
3. ✅ Can continue receiving other claims

### For the Claimant:
1. ❌ Claim is rejected
2. ❌ Cannot message the finder (no chat created)

### For Other Users:
1. ✅ Item still visible in "Browse Items"
2. ✅ Can submit claims on this item

---

## RLS Policy in Action

### Approval Button Click Sequence:
```
1. Frontend sends: PATCH /claims?id={claimId}
   { status: 'approved', approved_at: NOW() }

2. Supabase RLS Checks:
   ✓ Is user authenticated? YES
   ✓ Does this claim have status='pending'? YES
   ✓ Does user own the item? YES (checked via EXISTS query)
   ✓ Is new status in ['approved', 'rejected']? YES
   
3. RLS PASSES → Update succeeds
4. Frontend receives updated claim
5. Show success toast
```

### Rejection Button Click Sequence:
```
1. Frontend sends: PATCH /claims?id={claimId}
   { status: 'rejected', rejected_at: NOW() }

2. Supabase RLS Checks: (same as approval)

3. RLS PASSES → Update succeeds
4. Frontend receives updated claim
5. Show success toast
```

---

## Error Handling

### Common Errors:

**Error: "infinite recursion detected in policy"**
- ❌ Happened with old policy (now fixed)
- The policy had recursive subqueries

**Error: "Failed to update claim"**
- Check browser console for details
- Ensure user is logged in
- Ensure user owns the item
- Ensure claim status is 'pending'

**Error: "You can only view claims for your own items"**
- User tried to access claims page for item they don't own
- User redirected to /my-items

---

## Summary Table

| Action | Approve | Reject |
|--------|---------|--------|
| **Claim Status** | ✅ pending → approved | ✅ pending → rejected |
| **Item Status** | ✅ active → pending | ⏸ Stays active |
| **Chat Created** | ✅ Yes | ❌ No |
| **Other Claims** | ❌ Blocked | ✅ Accepted |
| **Claimant Notified** | ✅ Via chat | ❌ Not via chat |

---

## Next Steps (After Approval)

1. **Finder & Claimant Chat**
   - Exchange messages to arrange handover
   - Verify item details

2. **Handover**
   - They meet & hand over the item
   - Claimant verifies ownership

3. **Mark as Complete**
   - One of them marks the claim as 'completed'
   - Item is marked as 'returned'

4. **Close Chat**
   - Chat can be closed after handover

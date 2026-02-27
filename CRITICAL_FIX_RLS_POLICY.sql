-- ============================================================
-- CRITICAL FIX: Remove is_account_active() from RLS policies
-- ============================================================
-- The RLS policies reference is_account_active() which checks for
-- an 'account_status' column that doesn't exist in user_profiles
-- 
-- This is causing HTTP 400 errors on item uploads and other operations
-- ============================================================

-- Step 1: Fix items_insert_own policy (PRIMARY FIX FOR UPLOAD ERROR)
DROP POLICY IF EXISTS "items_insert_own" ON public.items;
CREATE POLICY "items_insert_own"
    ON public.items FOR INSERT
    TO authenticated
    WITH CHECK (finder_id = auth.uid());

-- Step 2: Fix user_profiles_select_public policy
DROP POLICY IF EXISTS "user_profiles_select_public" ON public.user_profiles;
CREATE POLICY "user_profiles_select_public"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (user_id != auth.uid());

-- Step 3: Fix user_profiles_update_own policy
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid()
        AND role = (SELECT role FROM public.user_profiles WHERE user_id = auth.uid())
        AND trust_score = (SELECT trust_score FROM public.user_profiles WHERE user_id = auth.uid())
    );

-- Step 4: Fix claims_insert_own policy
DROP POLICY IF EXISTS "claims_insert_own" ON public.claims;
CREATE POLICY "claims_insert_own"
    ON public.claims FOR INSERT
    TO authenticated
    WITH CHECK (
        claimant_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.items 
            WHERE id = claims.item_id 
            AND finder_id != auth.uid()
            AND status = 'active'
            AND is_flagged = false
        )
    );

-- Step 5: Fix messages_insert_own policy
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND is_chat_participant(chat_id)
        AND EXISTS (
            SELECT 1 FROM public.chats 
            WHERE id = messages.chat_id 
            AND enabled = true 
            AND is_closed = false
        )
    );

-- Step 6: Fix abuse_reports_insert_own policy
DROP POLICY IF EXISTS "abuse_reports_insert_own" ON public.abuse_reports;
CREATE POLICY "abuse_reports_insert_own"
    ON public.abuse_reports FOR INSERT
    TO authenticated
    WITH CHECK (reporter_id = auth.uid());

-- ============================================================
-- VERIFY THE FIXES
-- ============================================================

-- Check items_insert_own policy (most critical for uploads)
SELECT * FROM pg_policies 
WHERE tablename = 'items' 
AND policyname = 'items_insert_own';

-- Expected: Should show policy with just finder_id check, NO is_account_active()

-- ============================================================
-- AFTER APPLYING THIS FIX
-- ============================================================
-- 1. Apply these SQL changes in Supabase SQL Editor
-- 2. Go back to the app in browser
-- 3. Try uploading an item again
-- 4. It should now work without the 400 error!
-- 5. Check browser console for success: "[db.items.create] Item created successfully"

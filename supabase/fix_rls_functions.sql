-- ============================================================
-- FIX: Ensure RLS helper functions exist
-- ============================================================
-- Run this in Supabase SQL Editor if item insert fails
-- ============================================================

-- Check if user account is active (required by items INSERT policy)
CREATE OR REPLACE FUNCTION is_account_active()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid() 
        AND account_status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the function works
SELECT is_account_active();

-- Check items INSERT policy exists
SELECT * FROM pg_policies WHERE tablename = 'items' AND policyname LIKE '%insert%';

-- If the above returns empty, run this:
/*
CREATE POLICY "items_insert_own"
    ON public.items FOR INSERT
    TO authenticated
    WITH CHECK (
        finder_id = auth.uid()
        AND is_account_active()
    );
*/

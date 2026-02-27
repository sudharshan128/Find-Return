-- ============================================================
-- FIX: Item images show "No image available"
-- Root cause: item_images SELECT policy only allows status='active'
-- Once item is 'claimed', images are blocked → empty array → no image shown
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "item_images_select_all" ON public.item_images;

-- Recreate with all visible statuses (active, claimed, returned)
-- Valid item_status enum values: active, claimed, returned, expired, removed
CREATE POLICY "item_images_select_all"
    ON public.item_images FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE id = item_images.item_id
            AND status IN ('active', 'claimed', 'returned')
        )
    );

-- Verify: show all current item_images policies
SELECT
    policyname,
    cmd,
    roles,
    qual
FROM pg_policies
WHERE tablename = 'item_images'
ORDER BY policyname;

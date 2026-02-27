-- ============================================
-- CREATE increment_view_count RPC FUNCTION
-- ============================================
-- This function increments the view_count for an item
-- Called from frontend via: supabase.rpc('increment_view_count', { p_item_id: itemId })

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.increment_view_count(UUID);

-- Create the function
CREATE OR REPLACE FUNCTION public.increment_view_count(p_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.items
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_item_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_view_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_view_count(UUID) TO anon;

-- Verify the function exists
SELECT 
    routine_name,
    routine_schema,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'increment_view_count' 
AND routine_schema = 'public';

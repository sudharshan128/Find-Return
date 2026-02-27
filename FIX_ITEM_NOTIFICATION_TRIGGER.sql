-- ============================================================
-- FIX: Admin notification not created when item is posted
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Diagnose — are the trigger and function installed?
-- ============================================================
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('create_notification', 'notify_item_reported')
ORDER BY routine_name;

SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trigger_notify_item_reported';

-- ============================================================
-- STEP 2: Ensure notification_type enum includes 'item_reported'
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'item_reported'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'item_reported';
  END IF;
END$$;

-- ============================================================
-- STEP 3: Recreate create_notification function
-- (idempotent — safe to run multiple times)
-- ============================================================
CREATE OR REPLACE FUNCTION create_notification(
    p_type notification_type,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB DEFAULT '{}'::jsonb,
    p_target_admin_id UUID DEFAULT NULL,
    p_target_role TEXT DEFAULT NULL,
    p_priority INTEGER DEFAULT 1,
    p_user_id UUID DEFAULT NULL,
    p_item_id UUID DEFAULT NULL,
    p_claim_id UUID DEFAULT NULL,
    p_report_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (
        type, title, message, data,
        target_admin_id, target_role, priority,
        user_id, item_id, claim_id, report_id
    ) VALUES (
        p_type, p_title, p_message, p_data,
        p_target_admin_id, p_target_role, p_priority,
        p_user_id, p_item_id, p_claim_id, p_report_id
    ) RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO service_role;

-- ============================================================
-- STEP 4: Recreate notify_item_reported trigger function
-- Uses user_profiles (not users table)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_item_reported()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_category_name TEXT;
BEGIN
    -- Get poster's name/email from user_profiles
    SELECT full_name, email
    INTO v_user_record
    FROM user_profiles
    WHERE user_id = NEW.finder_id;

    -- Get category name
    SELECT name
    INTO v_category_name
    FROM categories
    WHERE id = NEW.category_id;

    PERFORM create_notification(
        'item_reported',
        'New Item Posted',
        format('%s posted a new %s item in %s',
            COALESCE(v_user_record.full_name, 'A user'),
            LOWER(NEW.status::text),
            COALESCE(v_category_name, 'unknown category')
        ),
        jsonb_build_object(
            'item_id',    NEW.id,
            'title',      NEW.title,
            'status',     NEW.status,
            'category',   v_category_name,
            'finder_id',  NEW.finder_id,
            'finder_name', COALESCE(v_user_record.full_name, 'Unknown'),
            'finder_email', v_user_record.email
        ),
        NULL,    -- target_admin_id  (NULL = all admins see it)
        NULL,    -- target_role
        2,       -- priority: medium
        NEW.finder_id,
        NEW.id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 5: Install / reinstall the trigger on items table
-- ============================================================
DROP TRIGGER IF EXISTS trigger_notify_item_reported ON public.items;

CREATE TRIGGER trigger_notify_item_reported
    AFTER INSERT ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION notify_item_reported();

-- ============================================================
-- STEP 6: Verify everything is in place
-- ============================================================
SELECT 'FUNCTIONS' AS check_type,
       routine_name,
       'EXISTS' AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('create_notification', 'notify_item_reported')

UNION ALL

SELECT 'TRIGGER',
       trigger_name,
       'EXISTS'
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trigger_notify_item_reported'

ORDER BY check_type, routine_name;

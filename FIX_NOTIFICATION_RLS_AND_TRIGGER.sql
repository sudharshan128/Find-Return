-- ============================================================
-- FIX: Notification not created on item post
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Check what values are in notification_type enum
-- ============================================================
SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'notification_type'
ORDER BY enumsortorder;

-- STEP 2: Check if any item_reported notifications exist at all
-- ============================================================
SELECT id, type, title, message, created_at
FROM notifications
WHERE type = 'item_reported'
ORDER BY created_at DESC
LIMIT 5;

-- STEP 3: Check if notifications were created recently (last 1 hour)
-- ============================================================
SELECT id, type, title, created_at
FROM notifications
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC;

-- STEP 4: Fix RLS — the INSERT policy only allows service_role,
-- but SECURITY DEFINER functions run as postgres (function owner).
-- Add a policy that also covers postgres superuser context.
-- ============================================================
DROP POLICY IF EXISTS "notifications_insert_service" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_any" ON public.notifications;

-- Allow both service_role AND postgres (for SECURITY DEFINER triggers)
CREATE POLICY "notifications_insert_service"
ON public.notifications FOR INSERT
WITH CHECK (true);  -- no role restriction = all roles including postgres trigger

-- STEP 5: Add 'item_reported' to enum if missing
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
    RAISE NOTICE 'Added item_reported to notification_type enum';
  ELSE
    RAISE NOTICE 'item_reported already in enum';
  END IF;
END$$;

-- STEP 6: Recreate trigger function, clean and simple
-- ============================================================
CREATE OR REPLACE FUNCTION notify_item_reported()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_email TEXT;
    v_category_name TEXT;
BEGIN
    SELECT up.full_name, up.email
    INTO v_full_name, v_email
    FROM user_profiles up
    WHERE up.user_id = NEW.finder_id;

    SELECT c.name INTO v_category_name
    FROM categories c
    WHERE c.id = NEW.category_id;

    INSERT INTO public.notifications (
        type, title, message, data, priority, user_id, item_id
    ) VALUES (
        'item_reported',
        'New Item Posted',
        format('%s posted a new %s item in %s',
            COALESCE(v_full_name, 'A user'),
            LOWER(NEW.status::text),
            COALESCE(v_category_name, 'unknown category')
        ),
        jsonb_build_object(
            'item_id',     NEW.id,
            'title',       NEW.title,
            'status',      NEW.status,
            'category',    v_category_name,
            'finder_id',   NEW.finder_id,
            'finder_name', COALESCE(v_full_name, 'Unknown'),
            'finder_email', COALESCE(v_email, '')
        ),
        2,
        NEW.finder_id,
        NEW.id
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_item_reported failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_notify_item_reported ON public.items;
CREATE TRIGGER trigger_notify_item_reported
    AFTER INSERT ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION notify_item_reported();

-- STEP 7: Manual test — simulate what the trigger does
-- ============================================================
INSERT INTO public.notifications (type, title, message, data, priority)
VALUES (
    'item_reported',
    '[MANUAL TEST] New Item Posted',
    'Manual test to verify insert works',
    '{"test": true}'::jsonb,
    2
);

-- STEP 8: Verify the manual test inserted
-- ============================================================
SELECT id, type, title, created_at FROM notifications
ORDER BY created_at DESC LIMIT 3;

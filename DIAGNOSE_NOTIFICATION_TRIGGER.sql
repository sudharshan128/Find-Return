-- ============================================================
-- DIAGNOSE + FIX: Why trigger doesn't create notification
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Check actual columns in notifications table
-- ============================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

-- STEP 2: Try manually calling create_notification — if this fails, shows the real error
-- ============================================================
SELECT create_notification(
    'item_reported'::notification_type,
    'Manual Test - Item Posted',
    'A user posted a test item',
    '{"item_id": "00000000-0000-0000-0000-000000000001", "title": "Test Item"}'::jsonb,
    NULL,
    NULL,
    2,
    NULL,
    NULL
);

-- STEP 3: Check if that test notification was inserted
-- ============================================================
SELECT id, type, title, message, created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 5;

-- STEP 4: Add report_id column if it's missing (common cause of silent failure)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND column_name = 'report_id'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN report_id UUID REFERENCES abuse_reports(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added missing report_id column';
    ELSE
        RAISE NOTICE 'report_id column already exists';
    END IF;
END$$;

-- STEP 5: Add any other missing columns create_notification might need
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND column_name = 'claim_id'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN claim_id UUID REFERENCES claims(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added missing claim_id column';
    ELSE
        RAISE NOTICE 'claim_id column already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND column_name = 'item_id'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN item_id UUID REFERENCES items(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added missing item_id column';
    ELSE
        RAISE NOTICE 'item_id column already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added missing user_id column';
    ELSE
        RAISE NOTICE 'user_id column already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND column_name = 'target_admin_id'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN target_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added missing target_admin_id column';
    ELSE
        RAISE NOTICE 'target_admin_id column already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND column_name = 'target_role'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN target_role TEXT;
        RAISE NOTICE 'Added missing target_role column';
    ELSE
        RAISE NOTICE 'target_role column already exists';
    END IF;
END$$;

-- STEP 6: Recreate create_notification to add exception handler so errors are visible
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
    INSERT INTO public.notifications (
        type, title, message, data,
        target_admin_id, target_role, priority,
        user_id, item_id, claim_id, report_id
    ) VALUES (
        p_type, p_title, p_message, p_data,
        p_target_admin_id, p_target_role, p_priority,
        p_user_id, p_item_id, p_claim_id, p_report_id
    ) RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
    -- Log the error instead of silently swallowing it
    RAISE WARNING 'create_notification failed: % %', SQLERRM, SQLSTATE;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO service_role;

-- STEP 7: Recreate notify_item_reported with error logging
-- ============================================================
CREATE OR REPLACE FUNCTION notify_item_reported()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_category_name TEXT;
    v_notification_id UUID;
BEGIN
    SELECT full_name, email
    INTO v_user_record
    FROM user_profiles
    WHERE user_id = NEW.finder_id;

    SELECT name
    INTO v_category_name
    FROM categories
    WHERE id = NEW.category_id;

    v_notification_id := create_notification(
        'item_reported',
        'New Item Posted',
        format('%s posted a new %s item in %s',
            COALESCE(v_user_record.full_name, 'A user'),
            LOWER(NEW.status::text),
            COALESCE(v_category_name, 'unknown category')
        ),
        jsonb_build_object(
            'item_id',     NEW.id,
            'title',       NEW.title,
            'status',      NEW.status,
            'category',    v_category_name,
            'finder_id',   NEW.finder_id,
            'finder_name', COALESCE(v_user_record.full_name, 'Unknown'),
            'finder_email', COALESCE(v_user_record.email, '')
        ),
        NULL,
        NULL,
        2,
        NEW.finder_id,
        NEW.id
    );

    IF v_notification_id IS NULL THEN
        RAISE WARNING 'notify_item_reported: create_notification returned NULL for item %', NEW.id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_item_reported trigger failed: % %', SQLERRM, SQLSTATE;
    RETURN NEW; -- Don't block the item insert
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reinstall trigger
DROP TRIGGER IF EXISTS trigger_notify_item_reported ON public.items;
CREATE TRIGGER trigger_notify_item_reported
    AFTER INSERT ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION notify_item_reported();

-- STEP 8: Final verify — post-setup check
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

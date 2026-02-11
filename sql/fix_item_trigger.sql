-- FIX: Cast enum to text before calling lower()
-- Run this in Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/yrdjpuvmijibfilrycnu/sql/new

CREATE OR REPLACE FUNCTION notify_item_reported()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_category_name TEXT;
BEGIN
    SELECT full_name, email INTO v_user_record FROM users WHERE id = NEW.finder_id;
    SELECT name INTO v_category_name FROM categories WHERE id = NEW.category_id;
    
    PERFORM create_notification(
        'item_reported',
        'New Item Posted',
        format('%s posted a new %s item in %s',
            COALESCE(v_user_record.full_name, 'A user'),
            LOWER(NEW.status::text),
            COALESCE(v_category_name, 'unknown category')
        ),
        jsonb_build_object(
            'item_id', NEW.id,
            'title', NEW.title,
            'status', NEW.status,
            'category', v_category_name,
            'finder_id', NEW.finder_id
        ),
        NULL,
        NULL,
        2,
        NEW.finder_id,
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FIX: Notification triggers query wrong table
-- The triggers were querying "users" table (0 rows)
-- but user data lives in "user_profiles" table.
-- 
-- Run this in Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/yrdjpuvmijibfilrycnu/sql/new
-- =============================================

-- 1. Fix notify_item_reported: users → user_profiles
CREATE OR REPLACE FUNCTION notify_item_reported()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_category_name TEXT;
BEGIN
    SELECT full_name, email INTO v_user_record FROM user_profiles WHERE user_id = NEW.finder_id;
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
            'finder_id', NEW.finder_id,
            'finder_name', COALESCE(v_user_record.full_name, 'Unknown'),
            'finder_email', v_user_record.email
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

-- 2. Fix notify_claim_submitted: users → user_profiles
CREATE OR REPLACE FUNCTION notify_claim_submitted()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_item_record RECORD;
BEGIN
    SELECT full_name, email INTO v_user_record FROM user_profiles WHERE user_id = NEW.claimant_id;
    SELECT title INTO v_item_record FROM items WHERE id = NEW.item_id;
    
    PERFORM create_notification(
        'claim_submitted',
        'New Claim Submitted',
        format('%s submitted a claim for "%s"',
            COALESCE(v_user_record.full_name, 'A user'),
            COALESCE(v_item_record.title, 'an item')
        ),
        jsonb_build_object(
            'claim_id', NEW.id,
            'item_id', NEW.item_id,
            'item_title', v_item_record.title,
            'claimant_id', NEW.claimant_id,
            'claimant_name', COALESCE(v_user_record.full_name, 'Unknown'),
            'claimant_email', v_user_record.email
        ),
        NULL,
        NULL,
        3,
        NEW.claimant_id,
        NEW.item_id,
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix notify_claim_status_change: users → user_profiles
CREATE OR REPLACE FUNCTION notify_claim_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_item_record RECORD;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        SELECT full_name INTO v_user_record FROM user_profiles WHERE user_id = NEW.claimant_id;
        SELECT title INTO v_item_record FROM items WHERE id = NEW.item_id;
        
        IF NEW.status = 'approved' THEN
            PERFORM create_notification(
                'claim_approved',
                'Claim Approved',
                format('Claim for "%s" by %s has been approved',
                    COALESCE(v_item_record.title, 'item'),
                    COALESCE(v_user_record.full_name, 'user')
                ),
                jsonb_build_object(
                    'claim_id', NEW.id,
                    'item_id', NEW.item_id,
                    'item_title', v_item_record.title,
                    'claimant_id', NEW.claimant_id,
                    'claimant_name', COALESCE(v_user_record.full_name, 'Unknown')
                ),
                NULL,
                'moderator',
                2,
                NEW.claimant_id,
                NEW.item_id,
                NEW.id
            );
        ELSIF NEW.status = 'rejected' THEN
            PERFORM create_notification(
                'claim_rejected',
                'Claim Rejected',
                format('Claim for "%s" by %s has been rejected',
                    COALESCE(v_item_record.title, 'item'),
                    COALESCE(v_user_record.full_name, 'user')
                ),
                jsonb_build_object(
                    'claim_id', NEW.id,
                    'item_id', NEW.item_id,
                    'item_title', v_item_record.title,
                    'claimant_id', NEW.claimant_id,
                    'claimant_name', COALESCE(v_user_record.full_name, 'Unknown')
                ),
                NULL,
                'moderator',
                2,
                NEW.claimant_id,
                NEW.item_id,
                NEW.id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix notify_abuse_report: users → user_profiles
CREATE OR REPLACE FUNCTION notify_abuse_report()
RETURNS TRIGGER AS $$
DECLARE
    v_reporter_name TEXT;
    v_target_name TEXT;
BEGIN
    SELECT full_name INTO v_reporter_name FROM user_profiles WHERE user_id = NEW.reporter_id;
    SELECT full_name INTO v_target_name FROM user_profiles WHERE user_id = NEW.target_user_id;
    
    PERFORM create_notification(
        'abuse_report',
        'New Abuse Report',
        format('%s reported %s - Reason: %s',
            COALESCE(v_reporter_name, 'A user'),
            COALESCE(v_target_name, 'a user'),
            COALESCE(NEW.reason, 'unspecified')
        ),
        jsonb_build_object(
            'report_id', NEW.id,
            'reporter_id', NEW.reporter_id,
            'reporter_name', COALESCE(v_reporter_name, 'Unknown'),
            'target_user_id', NEW.target_user_id,
            'target_name', COALESCE(v_target_name, 'Unknown'),
            'reason', NEW.reason,
            'description', NEW.description
        ),
        NULL,
        'moderator',
        4,
        NEW.target_user_id,
        NULL,
        NULL,
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done! All triggers now query user_profiles instead of users.
-- Test by posting a new item - the notification should show the user's name.

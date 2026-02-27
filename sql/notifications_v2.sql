-- ============================================
-- NOTIFICATIONS SYSTEM
-- Complete notification system for admin panel
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Create notification type enum (use DO block to avoid error if exists)
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'user_registered',
        'membership_approved',
        'membership_rejected',
        'item_reported',
        'claim_submitted',
        'claim_approved',
        'claim_rejected',
        'abuse_report',
        'user_banned',
        'chat_flagged',
        'system_alert'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    
    -- Target (who should see this notification)
    target_admin_id UUID,  -- specific admin user_id from auth.users
    target_role TEXT,       -- If NULL, all admins see it; otherwise specific role
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    read_by UUID,
    
    -- Priority
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5),
    
    -- Related entities
    user_id UUID,
    item_id UUID,
    claim_id UUID,
    report_id UUID,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    CONSTRAINT valid_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_target_admin ON notifications(target_admin_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON notifications(target_role) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at DESC) WHERE is_read = FALSE;

-- ============================================
-- GENERIC CREATE NOTIFICATION FUNCTION
-- ============================================

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

-- ============================================
-- TRIGGER FUNCTIONS FOR AUTO-NOTIFICATIONS
-- ============================================

-- 1. Notify when new user registers
CREATE OR REPLACE FUNCTION notify_user_registered()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_notification(
        'user_registered',
        'New User Registration',
        format('New user %s (%s) has registered', COALESCE(NEW.full_name, 'Unknown'), NEW.email),
        jsonb_build_object(
            'user_id', NEW.id,
            'email', NEW.email,
            'full_name', COALESCE(NEW.full_name, 'Unknown')
        ),
        NULL, -- visible to all admins
        NULL,
        2,   -- medium priority
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Notify when new item is reported/posted
CREATE OR REPLACE FUNCTION notify_item_reported()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_category_name TEXT;
BEGIN
    -- Get user details (from user_profiles, not users)
    SELECT full_name, email INTO v_user_record FROM user_profiles WHERE user_id = NEW.finder_id;
    
    -- Get category name
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
        NULL, -- All admins
        2,
        NEW.finder_id,
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Notify when new claim is submitted
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
            'claimant_name', v_user_record.full_name
        ),
        NULL,
        NULL, -- All admins
        3,   -- Higher priority
        NEW.claimant_id,
        NEW.item_id,
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Notify when claim status changes (approved/rejected)
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
                    'claimant_id', NEW.claimant_id
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
                    'claimant_id', NEW.claimant_id
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

-- 5. Notify when abuse report is created
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
            'target_user_id', NEW.target_user_id,
            'reason', NEW.reason,
            'description', NEW.description
        ),
        NULL,
        'moderator', -- Only moderators handle reports
        4,           -- High priority
        NEW.target_user_id,
        NULL,
        NULL,
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Notify when user is banned
CREATE OR REPLACE FUNCTION notify_user_banned()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.is_banned IS DISTINCT FROM NEW.is_banned) AND NEW.is_banned = TRUE THEN
        PERFORM create_notification(
            'user_banned',
            'User Banned',
            format('User %s (%s) has been banned. Reason: %s',
                COALESCE(NEW.full_name, 'Unknown'),
                NEW.email,
                COALESCE(NEW.ban_reason, 'No reason provided')
            ),
            jsonb_build_object(
                'user_id', NEW.id,
                'email', NEW.email,
                'full_name', NEW.full_name,
                'ban_reason', NEW.ban_reason,
                'banned_at', NEW.banned_at
            ),
            NULL,
            'super_admin',
            3,
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

-- Trigger on new user registration
DROP TRIGGER IF EXISTS trigger_notify_user_registered ON users;
CREATE TRIGGER trigger_notify_user_registered
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION notify_user_registered();

-- Trigger on new item posted
DROP TRIGGER IF EXISTS trigger_notify_item_reported ON items;
CREATE TRIGGER trigger_notify_item_reported
    AFTER INSERT ON items
    FOR EACH ROW
    EXECUTE FUNCTION notify_item_reported();

-- Trigger on new claim submitted
DROP TRIGGER IF EXISTS trigger_notify_claim_submitted ON claims;
CREATE TRIGGER trigger_notify_claim_submitted
    AFTER INSERT ON claims
    FOR EACH ROW
    EXECUTE FUNCTION notify_claim_submitted();

-- Trigger on claim status change
DROP TRIGGER IF EXISTS trigger_notify_claim_status_change ON claims;
CREATE TRIGGER trigger_notify_claim_status_change
    AFTER UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION notify_claim_status_change();

-- Trigger on abuse report
DROP TRIGGER IF EXISTS trigger_notify_abuse_report ON abuse_reports;
CREATE TRIGGER trigger_notify_abuse_report
    AFTER INSERT ON abuse_reports
    FOR EACH ROW
    EXECUTE FUNCTION notify_abuse_report();

-- Trigger on user banned
DROP TRIGGER IF EXISTS trigger_notify_user_banned ON users;
CREATE TRIGGER trigger_notify_user_banned
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION notify_user_banned();

-- ============================================
-- RLS POLICIES (backend uses service role, but good to have)
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so these are for safety only
CREATE POLICY "Service role full access on notifications"
    ON notifications FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET is_read = TRUE,
        read_at = NOW(),
        read_by = auth.uid()
    WHERE id = p_notification_id
        AND is_read = FALSE;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE is_read = TRUE
        AND read_at < NOW() - (days_old || ' days')::INTERVAL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANTS
-- ============================================

GRANT ALL ON notifications TO service_role;
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO service_role;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications TO service_role;

-- ============================================
-- DONE! Notifications system is ready.
-- ============================================

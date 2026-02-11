-- ============================================
-- NOTIFICATIONS SYSTEM
-- Complete notification system for admin panel
-- ============================================

-- Create notification type enum
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

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    
    -- Target (who should see this notification)
    target_admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target_role TEXT, -- If NULL, all admins see it; otherwise specific role (super_admin, moderator, analyst)
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Priority
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5), -- 1=low, 5=urgent
    
    -- Related entities
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    item_id UUID,
    claim_id UUID,
    report_id UUID,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Optional: notifications can expire
    
    -- Indexes for fast querying
    CONSTRAINT valid_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX idx_notifications_target_admin ON notifications(target_admin_id) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_target_role ON notifications(target_role) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_priority ON notifications(priority DESC);
CREATE INDEX idx_notifications_unread ON notifications(is_read, created_at DESC) WHERE is_read = FALSE;

-- ============================================
-- FUNCTIONS TO CREATE NOTIFICATIONS
-- ============================================

-- Generic function to create notification
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

-- Notify when new user registers
CREATE OR REPLACE FUNCTION notify_user_registered()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_notification(
        'user_registered',
        'New User Registration',
        format('New user %s (%s) has registered', NEW.full_name, NEW.email),
        jsonb_build_object(
            'user_id', NEW.id,
            'email', NEW.email,
            'full_name', NEW.full_name
        ),
        NULL, -- visible to all admins
        NULL,
        2, -- medium priority
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when membership application status changes
CREATE OR REPLACE FUNCTION notify_membership_status()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
BEGIN
    -- Only trigger if account_status changes
    IF OLD.account_status IS DISTINCT FROM NEW.account_status THEN
        SELECT * INTO v_user_record FROM users WHERE id = NEW.id;
        
        IF NEW.account_status = 'approved' THEN
            PERFORM create_notification(
                'membership_approved',
                'Membership Approved',
                format('User %s (%s) membership has been approved', 
                    COALESCE(v_user_record.full_name, 'Unknown'), 
                    v_user_record.email),
                jsonb_build_object(
                    'user_id', NEW.id,
                    'email', v_user_record.email,
                    'full_name', v_user_record.full_name,
                    'approved_at', NEW.updated_at
                ),
                NULL,
                'super_admin', -- Only super admins need to know
                1,
                NEW.id
            );
        ELSIF NEW.account_status = 'rejected' THEN
            PERFORM create_notification(
                'membership_rejected',
                'Membership Rejected',
                format('User %s (%s) membership has been rejected', 
                    COALESCE(v_user_record.full_name, 'Unknown'), 
                    v_user_record.email),
                jsonb_build_object(
                    'user_id', NEW.id,
                    'email', v_user_record.email,
                    'full_name', v_user_record.full_name,
                    'rejected_at', NEW.updated_at
                ),
                NULL,
                'super_admin',
                1,
                NEW.id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when new item is reported
CREATE OR REPLACE FUNCTION notify_item_reported()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_category_name TEXT;
BEGIN
    -- Get user details
    SELECT * INTO v_user_record FROM users WHERE id = NEW.user_id;
    
    -- Get category name
    SELECT name INTO v_category_name FROM categories WHERE id = NEW.category_id;
    
    PERFORM create_notification(
        'item_reported',
        'New Item Reported',
        format('%s reported a new %s item in %s',
            COALESCE(v_user_record.full_name, 'A user'),
            LOWER(NEW.status),
            COALESCE(v_category_name, 'unknown category')
        ),
        jsonb_build_object(
            'item_id', NEW.id,
            'title', NEW.title,
            'status', NEW.status,
            'category', v_category_name,
            'user_id', NEW.user_id
        ),
        NULL,
        NULL, -- All admins
        2,
        NEW.user_id,
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when new claim is submitted
CREATE OR REPLACE FUNCTION notify_claim_submitted()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_item_record RECORD;
BEGIN
    -- Get user and item details
    SELECT * INTO v_user_record FROM users WHERE id = NEW.claimant_id;
    SELECT * INTO v_item_record FROM items WHERE id = NEW.item_id;
    
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
        3, -- Higher priority
        NEW.claimant_id,
        NEW.item_id,
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when claim status changes
CREATE OR REPLACE FUNCTION notify_claim_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_item_record RECORD;
BEGIN
    -- Only trigger if status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        SELECT * INTO v_user_record FROM users WHERE id = NEW.claimant_id;
        SELECT * INTO v_item_record FROM items WHERE id = NEW.item_id;
        
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

-- Notify when abuse report is created
CREATE OR REPLACE FUNCTION notify_abuse_report()
RETURNS TRIGGER AS $$
DECLARE
    v_reporter_record RECORD;
    v_reported_record RECORD;
BEGIN
    SELECT * INTO v_reporter_record FROM users WHERE id = NEW.reporter_id;
    SELECT * INTO v_reported_record FROM users WHERE id = NEW.reported_user_id;
    
    PERFORM create_notification(
        'abuse_report',
        'New Abuse Report',
        format('%s reported %s for %s',
            COALESCE(v_reporter_record.full_name, 'A user'),
            COALESCE(v_reported_record.full_name, 'a user'),
            NEW.reason
        ),
        jsonb_build_object(
            'report_id', NEW.id,
            'reporter_id', NEW.reporter_id,
            'reported_user_id', NEW.reported_user_id,
            'reason', NEW.reason,
            'type', NEW.type
        ),
        NULL,
        'moderator', -- Only moderators handle reports
        4, -- High priority
        NEW.reported_user_id,
        NULL,
        NULL,
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when user is banned
CREATE OR REPLACE FUNCTION notify_user_banned()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if is_banned changes to true
    IF OLD.is_banned = FALSE AND NEW.is_banned = TRUE THEN
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
                'banned_until', NEW.banned_until
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

-- Trigger on membership status change
DROP TRIGGER IF EXISTS trigger_notify_membership_status ON users;
CREATE TRIGGER trigger_notify_membership_status
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION notify_membership_status();

-- Trigger on new item reported (if items table exists)
DROP TRIGGER IF EXISTS trigger_notify_item_reported ON items;
CREATE TRIGGER trigger_notify_item_reported
    AFTER INSERT ON items
    FOR EACH ROW
    EXECUTE FUNCTION notify_item_reported();

-- Trigger on new claim submitted (if claims table exists)
DROP TRIGGER IF EXISTS trigger_notify_claim_submitted ON claims;
CREATE TRIGGER trigger_notify_claim_submitted
    AFTER INSERT ON claims
    FOR EACH ROW
    EXECUTE FUNCTION notify_claim_submitted();

-- Trigger on claim status change (if claims table exists)
DROP TRIGGER IF EXISTS trigger_notify_claim_status_change ON claims;
CREATE TRIGGER trigger_notify_claim_status_change
    AFTER UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION notify_claim_status_change();

-- Trigger on abuse report (if abuse_reports table exists)
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
-- RLS POLICIES FOR NOTIFICATIONS
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admins can see notifications targeted to them or their role
CREATE POLICY "Admins can view their notifications"
    ON notifications FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('admin') -- Adjust based on your admin roles
        )
        AND (
            target_admin_id = auth.uid()
            OR target_admin_id IS NULL
            OR target_role = (SELECT role FROM users WHERE id = auth.uid())
            OR target_role IS NULL
        )
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- Admins can mark notifications as read
CREATE POLICY "Admins can update their notifications"
    ON notifications FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('admin')
        )
        AND (
            target_admin_id = auth.uid()
            OR target_admin_id IS NULL
            OR target_role = (SELECT role FROM users WHERE id = auth.uid())
            OR target_role IS NULL
        )
    );

-- Only system can create notifications (through functions)
CREATE POLICY "Only system can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (FALSE); -- Only SECURITY DEFINER functions can create

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET is_read = TRUE,
        read_at = NOW(),
        read_by = auth.uid()
    WHERE id = notification_id
        AND is_read = FALSE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for current user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
    v_user_role TEXT;
BEGIN
    SELECT role INTO v_user_role FROM users WHERE id = auth.uid();
    
    UPDATE notifications
    SET is_read = TRUE,
        read_at = NOW(),
        read_by = auth.uid()
    WHERE is_read = FALSE
        AND (
            target_admin_id = auth.uid()
            OR target_admin_id IS NULL
            OR target_role = v_user_role
            OR target_role IS NULL
        );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete old read notifications
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
-- GRANT PERMISSIONS
-- ============================================

GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE notifications IS 'System notifications for admin panel';
COMMENT ON FUNCTION create_notification IS 'Creates a new notification for admins';
COMMENT ON FUNCTION mark_notification_read IS 'Marks a single notification as read';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Marks all notifications as read for current user';
COMMENT ON FUNCTION cleanup_old_notifications IS 'Deletes old read notifications to keep table clean';

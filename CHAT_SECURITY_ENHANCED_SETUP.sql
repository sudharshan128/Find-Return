-- ============================================================
-- CHAT SECURITY ENHANCEMENTS - OPTION B
-- ============================================================
-- 1. User Blocking System
-- 2. Message Retention Policies
-- 3. Secure Image Metadata
-- 4. Enhanced Audit Logging
-- ============================================================

-- ============================================================
-- 1. BLOCKED USERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Who blocked whom
    blocker_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Context
    reason TEXT,
    chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Prevent duplicate blocks
    UNIQUE(blocker_id, blocked_id),
    
    -- Cannot block yourself
    CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

COMMENT ON TABLE public.blocked_users IS 'User blocking system for preventing unwanted communication';

-- ============================================================
-- 2. MESSAGE METADATA (for encryption)
-- ============================================================

-- Add encryption flag to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS encryption_version TEXT DEFAULT 'v1';

COMMENT ON COLUMN public.messages.is_encrypted IS 'Whether message content is encrypted (E2EE)';
COMMENT ON COLUMN public.messages.encryption_version IS 'Encryption algorithm version for future upgrades';

-- ============================================================
-- 3. MESSAGE RETENTION SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_retention_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scope (global or per category)
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    
    -- Retention period in days (NULL = keep forever)
    retention_days INTEGER,
    
    -- Auto-delete old messages
    auto_delete_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Only one setting per category (NULL for global)
    UNIQUE(category_id)
);

COMMENT ON TABLE public.message_retention_settings IS 'Configure how long messages are retained before auto-deletion';

-- Default: Keep messages for 90 days (global setting)
INSERT INTO public.message_retention_settings (category_id, retention_days, auto_delete_enabled)
VALUES (NULL, 90, TRUE)
ON CONFLICT (category_id) DO NOTHING;

-- ============================================================
-- 4. CHAT IMAGE ATTACHMENTS (secure)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent message
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    
    -- Uploader
    uploaded_by UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- File details
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- image/jpeg, image/png, etc.
    file_size INTEGER NOT NULL, -- bytes
    storage_path TEXT NOT NULL, -- path in Supabase storage
    
    -- Security
    is_encrypted BOOLEAN DEFAULT TRUE NOT NULL,
    is_scanned BOOLEAN DEFAULT FALSE NOT NULL,
    scan_result TEXT, -- clean, suspicious, malicious
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- File size limit: 10MB
    CONSTRAINT file_size_limit CHECK (file_size <= 10485760)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message ON public.chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_chat ON public.chat_attachments(chat_id);

COMMENT ON TABLE public.chat_attachments IS 'Secure file attachments for chat messages';

-- ============================================================
-- 5. AUDIT LOG FOR SECURITY EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_security_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event details
    event_type TEXT NOT NULL, -- 'block_user', 'unblock_user', 'spam_detected', 'message_deleted', etc.
    user_id UUID REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
    chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    
    -- Context
    metadata JSONB, -- additional event data
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_security_log_event ON public.chat_security_log(event_type);
CREATE INDEX IF NOT EXISTS idx_chat_security_log_user ON public.chat_security_log(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_security_log_created ON public.chat_security_log(created_at);

COMMENT ON TABLE public.chat_security_log IS 'Audit trail for security events in chat system';

-- ============================================================
-- 6. RLS POLICIES - BLOCKED USERS
-- ============================================================

-- Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_retention_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_security_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view who they blocked
DROP POLICY IF EXISTS "Users can view their blocks" ON public.blocked_users;
CREATE POLICY "Users can view their blocks"
    ON public.blocked_users FOR SELECT
    USING (auth.uid() = blocker_id);

-- Policy: Users can block others
DROP POLICY IF EXISTS "Users can block others" ON public.blocked_users;
CREATE POLICY "Users can block others"
    ON public.blocked_users FOR INSERT
    WITH CHECK (auth.uid() = blocker_id);

-- Policy: Users can unblock (delete)
DROP POLICY IF EXISTS "Users can unblock" ON public.blocked_users;
CREATE POLICY "Users can unblock"
    ON public.blocked_users FOR DELETE
    USING (auth.uid() = blocker_id);

-- ============================================================
-- 7. RLS POLICIES - CHAT ATTACHMENTS
-- ============================================================

-- Policy: Chat participants can view attachments
DROP POLICY IF EXISTS "Chat participants can view attachments" ON public.chat_attachments;
CREATE POLICY "Chat participants can view attachments"
    ON public.chat_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = chat_attachments.chat_id
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
        )
    );

-- Policy: Chat participants can upload attachments
DROP POLICY IF EXISTS "Chat participants can upload attachments" ON public.chat_attachments;
CREATE POLICY "Chat participants can upload attachments"
    ON public.chat_attachments FOR INSERT
    WITH CHECK (
        auth.uid() = uploaded_by
        AND EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = chat_attachments.chat_id
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
            AND chats.is_closed = FALSE
        )
    );

-- ============================================================
-- 8. UPDATED MESSAGE POLICY - BLOCK ENFORCEMENT
-- ============================================================

-- Drop existing send message policies
DROP POLICY IF EXISTS "Chat participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Chat participants can send messages (with block check)" ON public.messages;

-- Recreate with block checking
CREATE POLICY "Chat participants can send messages (with block check)"
    ON public.messages FOR INSERT
    WITH CHECK (
        -- Must be authenticated
        auth.uid() = sender_id
        -- Must be a participant of the chat
        AND EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
            AND chats.is_closed = FALSE
            AND chats.enabled = TRUE
        )
        -- Must not be blocked by the other participant
        AND NOT EXISTS (
            SELECT 1 FROM public.blocked_users
            WHERE blocked_users.blocked_id = auth.uid()
            AND blocked_users.blocker_id IN (
                SELECT finder_id FROM public.chats WHERE chats.id = messages.chat_id
                UNION
                SELECT claimant_id FROM public.chats WHERE chats.id = messages.chat_id
            )
        )
    );

-- ============================================================
-- 9. MESSAGE RETENTION CLEANUP FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    global_retention INTEGER;
BEGIN
    -- Get global retention setting
    SELECT retention_days INTO global_retention
    FROM public.message_retention_settings
    WHERE category_id IS NULL AND auto_delete_enabled = TRUE
    LIMIT 1;
    
    -- Delete messages older than retention period
    IF global_retention IS NOT NULL THEN
        WITH deleted AS (
            DELETE FROM public.messages
            WHERE created_at < NOW() - (global_retention || ' days')::INTERVAL
            AND is_deleted = FALSE
            RETURNING *
        )
        SELECT COUNT(*) INTO deleted_count FROM deleted;
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_old_messages IS 'Automatically delete messages older than retention period';

-- ============================================================
-- 10. SPAM DETECTION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_spam_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    recent_count INTEGER;
    time_window INTERVAL := '1 minute'::INTERVAL;
    max_messages INTEGER := 10; -- 10 messages per minute per user per chat
BEGIN
    -- Count recent messages from this user in this chat
    SELECT COUNT(*) INTO recent_count
    FROM public.messages
    WHERE chat_id = NEW.chat_id
    AND sender_id = NEW.sender_id
    AND created_at > NOW() - time_window;
    
    -- Reject if exceeds rate limit
    IF recent_count >= max_messages THEN
        -- Log spam attempt
        INSERT INTO public.chat_security_log (event_type, user_id, chat_id, metadata)
        VALUES (
            'spam_detected',
            NEW.sender_id,
            NEW.chat_id,
            jsonb_build_object('message_count', recent_count, 'time_window', time_window)
        );
        
        RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more messages.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS check_spam_before_insert ON public.messages;
CREATE TRIGGER check_spam_before_insert
    BEFORE INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.check_spam_rate_limit();

COMMENT ON FUNCTION public.check_spam_rate_limit IS 'Prevent spam by rate limiting messages per user per chat';

-- ============================================================
-- 11. HELPER FUNCTIONS
-- ============================================================

-- Function: Block a user
CREATE OR REPLACE FUNCTION public.block_user(
    p_blocked_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_chat_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_block_id UUID;
BEGIN
    INSERT INTO public.blocked_users (blocker_id, blocked_id, reason, chat_id)
    VALUES (auth.uid(), p_blocked_id, p_reason, p_chat_id)
    ON CONFLICT (blocker_id, blocked_id) DO UPDATE
    SET reason = EXCLUDED.reason, chat_id = EXCLUDED.chat_id
    RETURNING id INTO v_block_id;
    
    -- Log the block
    INSERT INTO public.chat_security_log (event_type, user_id, chat_id, metadata)
    VALUES (
        'block_user',
        auth.uid(),
        p_chat_id,
        jsonb_build_object('blocked_user_id', p_blocked_id, 'reason', p_reason)
    );
    
    RETURN v_block_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Unblock a user
CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_deleted BOOLEAN;
BEGIN
    DELETE FROM public.blocked_users
    WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    IF v_deleted THEN
        INSERT INTO public.chat_security_log (event_type, user_id, metadata)
        VALUES (
            'unblock_user',
            auth.uid(),
            jsonb_build_object('blocked_user_id', p_blocked_id)
        );
    END IF;
    
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user is blocked
CREATE OR REPLACE FUNCTION public.is_user_blocked(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.blocked_users
        WHERE blocker_id = auth.uid() AND blocked_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================

-- Run this to verify everything was created successfully
DO $$
DECLARE
    blocked_users_count INTEGER;
    attachments_count INTEGER;
    retention_count INTEGER;
    security_log_count INTEGER;
    policies_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO blocked_users_count FROM pg_tables WHERE tablename = 'blocked_users';
    SELECT COUNT(*) INTO attachments_count FROM pg_tables WHERE tablename = 'chat_attachments';
    SELECT COUNT(*) INTO retention_count FROM pg_tables WHERE tablename = 'message_retention_settings';
    SELECT COUNT(*) INTO security_log_count FROM pg_tables WHERE tablename = 'chat_security_log';
    
    SELECT COUNT(*) INTO policies_count 
    FROM pg_policies 
    WHERE tablename IN ('blocked_users', 'chat_attachments', 'messages')
    AND policyname LIKE '%block%' OR policyname LIKE '%attachment%';
    
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'SECURITY ENHANCEMENT SETUP COMPLETE!';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - blocked_users: %', CASE WHEN blocked_users_count > 0 THEN '✓' ELSE '✗' END;
    RAISE NOTICE '  - chat_attachments: %', CASE WHEN attachments_count > 0 THEN '✓' ELSE '✗' END;
    RAISE NOTICE '  - message_retention_settings: %', CASE WHEN retention_count > 0 THEN '✓' ELSE '✗' END;
    RAISE NOTICE '  - chat_security_log: %', CASE WHEN security_log_count > 0 THEN '✓' ELSE '✗' END;
    RAISE NOTICE 'Security policies: % active', policies_count;
    RAISE NOTICE '==========================================';
END $$;

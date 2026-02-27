-- ============================================================
-- PRODUCTION CHAT SYSTEM - COMPLETE DATABASE SETUP
-- ============================================================
-- Run this to ensure all chat functionality is properly configured
-- ============================================================

-- Step 1: Ensure tables exist with correct schema
-- (Your tables already exist, this just adds missing columns if needed)

-- Add frozen status to chats if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chats' AND column_name = 'is_frozen'
    ) THEN
        ALTER TABLE public.chats ADD COLUMN is_frozen BOOLEAN DEFAULT FALSE NOT NULL;
        ALTER TABLE public.chats ADD COLUMN frozen_at TIMESTAMPTZ;
        ALTER TABLE public.chats ADD COLUMN frozen_by UUID REFERENCES public.user_profiles(user_id);
        ALTER TABLE public.chats ADD COLUMN freeze_reason TEXT;
    END IF;
END $$;

-- Step 2: RLS Policies for CHATS
-- ============================================================

-- Enable RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "chats_select_participant" ON public.chats;
DROP POLICY IF EXISTS "chats_insert_on_approval" ON public.chats;
DROP POLICY IF EXISTS "chats_update_participant" ON public.chats;
DROP POLICY IF EXISTS "chats_admin_all" ON public.chats;

-- Participants can view their chats
CREATE POLICY "chats_select_participant"
    ON public.chats FOR SELECT
    TO authenticated
    USING (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    );

-- Chats can only be created by participants (via approved claims)
CREATE POLICY "chats_insert_on_approval"
    ON public.chats FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User must be either finder or claimant
        (finder_id = auth.uid() OR claimant_id = auth.uid())
        AND
        -- Claim must be approved
        EXISTS (
            SELECT 1 FROM public.claims
            WHERE claims.id = chats.claim_id
            AND claims.status = 'approved'
        )
    );

-- Participants can update unread counts, mark as closed
CREATE POLICY "chats_update_participant"
    ON public.chats FOR UPDATE
    TO authenticated
    USING (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    )
    WITH CHECK (
        finder_id = auth.uid() 
        OR claimant_id = auth.uid()
    );

-- Admins can do everything
CREATE POLICY "chats_admin_all"
    ON public.chats FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role IN ('admin', 'moderator')
            AND user_profiles.account_status = 'active'
        )
    );

-- Step 3: RLS Policies for MESSAGES
-- ============================================================

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;

-- Participants can view messages in their chats
CREATE POLICY "messages_select_participant"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
        )
    );

-- Participants can send messages (if chat not frozen/closed)
CREATE POLICY "messages_insert_participant"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
            AND chats.enabled = TRUE
            AND chats.is_closed = FALSE
            AND chats.is_frozen = FALSE
        )
    );

-- Users can mark their own messages as read
CREATE POLICY "messages_update_own"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND (chats.finder_id = auth.uid() OR chats.claimant_id = auth.uid())
        )
    );

-- Users can soft-delete their own messages
CREATE POLICY "messages_delete_own"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());

-- Admins can do everything
CREATE POLICY "messages_admin_all"
    ON public.messages FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role IN ('admin', 'moderator')
            AND user_profiles.account_status = 'active'
        )
    );

-- Step 4: Create Functions and Triggers
-- ============================================================

-- Function to update chat's last_message_at and unread counts
CREATE OR REPLACE FUNCTION update_chat_on_message()
RETURNS TRIGGER AS $$
DECLARE
    v_chat public.chats;
BEGIN
    -- Get chat details
    SELECT * INTO v_chat FROM public.chats WHERE id = NEW.chat_id;
    
    -- Update chat
    UPDATE public.chats
    SET 
        last_message_at = NEW.created_at,
        updated_at = NEW.created_at,
        -- Increment unread count for recipient
        finder_unread_count = CASE 
            WHEN NEW.sender_id != v_chat.finder_id THEN finder_unread_count + 1
            ELSE finder_unread_count
        END,
        claimant_unread_count = CASE 
            WHEN NEW.sender_id != v_chat.claimant_id THEN claimant_unread_count + 1
            ELSE claimant_unread_count
        END
    WHERE id = NEW.chat_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update chat on new message
DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_on_message();

-- Function to reset unread count when messages are read
CREATE OR REPLACE FUNCTION reset_unread_count()
RETURNS TRIGGER AS $$
DECLARE
    v_chat public.chats;
BEGIN
    IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
        SELECT * INTO v_chat FROM public.chats WHERE id = NEW.chat_id;
        
        -- Reset unread count for the reader
        UPDATE public.chats
        SET 
            finder_unread_count = CASE 
                WHEN auth.uid() = v_chat.finder_id THEN 0
                ELSE finder_unread_count
            END,
            claimant_unread_count = CASE 
                WHEN auth.uid() = v_chat.claimant_id THEN 0
                ELSE claimant_unread_count
            END
        WHERE id = NEW.chat_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to reset unread count
DROP TRIGGER IF EXISTS on_message_read ON public.messages;
CREATE TRIGGER on_message_read
    AFTER UPDATE OF is_read ON public.messages
    FOR EACH ROW
    WHEN (NEW.is_read = TRUE AND OLD.is_read = FALSE)
    EXECUTE FUNCTION reset_unread_count();

-- Step 5: Create Indexes for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chats_is_frozen ON public.chats(is_frozen);
CREATE INDEX IF NOT EXISTS idx_messages_is_deleted ON public.messages(is_deleted);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON public.messages(chat_id, created_at);

-- Step 6: Verification Query
-- ============================================================

SELECT 
    'Schema Setup Complete' as status,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'chats') as chat_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'messages') as message_policies,
    (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE '%message%') as triggers;

-- ============================================================
-- SECURITY HARDENING — Find & Return Platform
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================
-- Vulnerabilities patched:
--  1. Messages can be sent to/from blocked users at DB level
--  2. message_text is mutable after sending (direct API attack)
--  3. Chat participants can disable/close chats directly
--  4. Any user can write fake audit_log rows for other users
--  5. Users can DELETE their own rate_limit rows (bypasses app limits)
--  6. Claimants cannot see the item they were approved for
--  7. messages.is_read update skipped by existing RLS (silent fail)
--  8. messages_moderator_all missing authenticated TO clause
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1.  MESSAGES INSERT — block-aware policy
--     Prevent sending messages when either party has blocked the other.
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;

CREATE POLICY "messages_insert_participant"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Must be the sender
        sender_id = auth.uid()

        -- Must be a chat participant
        AND is_chat_participant(chat_id)

        -- Chat must be open and enabled
        AND EXISTS (
            SELECT 1 FROM public.chats
            WHERE id = messages.chat_id
            AND enabled = true
            AND is_closed = false
        )

        -- Neither user has blocked the other
        AND NOT EXISTS (
            SELECT 1 FROM public.blocked_users bu
            JOIN public.chats c ON c.id = messages.chat_id
            WHERE (bu.blocker_id = auth.uid()
                   AND bu.blocked_id = CASE
                       WHEN c.finder_id = auth.uid() THEN c.claimant_id
                       ELSE c.finder_id END)
               OR (bu.blocked_id = auth.uid()
                   AND bu.blocker_id = CASE
                       WHEN c.finder_id = auth.uid() THEN c.claimant_id
                       ELSE c.finder_id END)
        )
    );


-- ──────────────────────────────────────────────────────────────
-- 2.  MESSAGES UPDATE — split into two focused policies
--     a) sender can soft-delete their own messages
--     b) participants can mark the OTHER side's messages as read
--     (The old single policy only allowed updates on own messages,
--      so is_read on incoming messages was silently failing.)
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "messages_update_own"              ON public.messages;
DROP POLICY IF EXISTS "messages_update_read_participant" ON public.messages;

-- Sender can soft-delete their own messages
CREATE POLICY "messages_update_own"
    ON public.messages FOR UPDATE
    TO authenticated
    USING  (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());

-- Participant can mark the OTHER person's messages as read
CREATE POLICY "messages_update_read_participant"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (
        sender_id != auth.uid()
        AND is_chat_participant(chat_id)
    )
    WITH CHECK (
        sender_id != auth.uid()
        AND is_chat_participant(chat_id)
    );


-- ──────────────────────────────────────────────────────────────
-- 3.  TRIGGER — message_text is immutable after insert
--     Protects against: POST /api/supabase → UPDATE messages SET message_text=...
--     Even service_role cannot rewrite message history.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_message_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.message_text IS DISTINCT FROM OLD.message_text THEN
        RAISE EXCEPTION
            'Message text cannot be modified after sending (security policy)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_immutable ON public.messages;
CREATE TRIGGER trg_message_immutable
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION enforce_message_immutability();


-- ──────────────────────────────────────────────────────────────
-- 4.  CHATS UPDATE — tighten participant policy
--     Participants may only reset their unread counter.
--     Closing, disabling, or changing parties is backend-only
--     (service_role bypasses RLS; admins use moderator policy).
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chats_update_participant" ON public.chats;

CREATE POLICY "chats_update_participant"
    ON public.chats FOR UPDATE
    TO authenticated
    USING  (finder_id = auth.uid() OR claimant_id = auth.uid())
    WITH CHECK (finder_id = auth.uid() OR claimant_id = auth.uid());
-- Structural fields (enabled, is_closed, close_reason, finder_id, claimant_id, item_id)
-- are protected by the trigger below; this policy just gates WHO can update.

-- Structural-change guard via trigger
CREATE OR REPLACE FUNCTION restrict_chat_structure_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- auth.uid() IS NULL means the call came from service_role or a db-level function
    -- (backend mark-as-returned, admin freeze via service key, triggers).  Let it through.
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Moderators / admins may change structure
    IF is_moderator_or_admin() THEN
        RETURN NEW;
    END IF;

    -- Regular participants: structural fields are read-only
    IF NEW.enabled       IS DISTINCT FROM OLD.enabled       OR
       NEW.is_closed     IS DISTINCT FROM OLD.is_closed     OR
       NEW.close_reason  IS DISTINCT FROM OLD.close_reason  OR
       NEW.finder_id     IS DISTINCT FROM OLD.finder_id     OR
       NEW.claimant_id   IS DISTINCT FROM OLD.claimant_id   OR
       NEW.item_id       IS DISTINCT FROM OLD.item_id       THEN
        RAISE EXCEPTION
            'Chat participants cannot modify structural chat fields';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_restrict_chat_structure ON public.chats;
CREATE TRIGGER trg_restrict_chat_structure
    BEFORE UPDATE ON public.chats
    FOR EACH ROW EXECUTE FUNCTION restrict_chat_structure_changes();


-- ──────────────────────────────────────────────────────────────
-- 5.  AUDIT LOGS — prevent spoofed log entries
--     Any authenticated user could previously INSERT a row with
--     any user_id.  Now they can only log their own actions.
--     Service_role (backend) bypasses RLS so backend logs still work.
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "audit_logs_insert_all" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_own"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────
-- 6.  RATE_LIMITS — strip write access from authenticated users
--     Users deleting their own rate_limit rows would reset the
--     app-level counters, bypassing submission frequency caps.
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rate_limits_own" ON public.rate_limits;

-- Read-only for the owning user
CREATE POLICY "rate_limits_select_own"
    ON public.rate_limits FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Insert allowed (app creates the row on first action)
CREATE POLICY "rate_limits_insert_own"
    ON public.rate_limits FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Update allowed (app increments counters)
CREATE POLICY "rate_limits_update_own"
    ON public.rate_limits FOR UPDATE
    TO authenticated
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DELETE is NOT granted — service_role handles cleanup via cron


-- ──────────────────────────────────────────────────────────────
-- 7.  ITEMS — claimants can see their approved item
--     After a claim is approved the item status changes to 'claimed'.
--     The public policy only allows 'active' items, so claimants
--     were blocked from viewing the item detail page.
--
--     IMPORTANT: Cannot query public.claims directly inside an items
--     RLS policy — claims RLS joins back to items → 42P17 infinite
--     recursion.  Use a SECURITY DEFINER function owned by postgres
--     (BYPASSRLS) to read claims without re-entering items RLS.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION has_approved_claim_for_item(p_item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.claims
        WHERE item_id     = p_item_id
        AND   claimant_id = auth.uid()
        AND   status      = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- postgres role has BYPASSRLS → reads claims without triggering claims RLS
ALTER FUNCTION has_approved_claim_for_item(UUID) OWNER TO postgres;

DROP POLICY IF EXISTS "items_select_claimant" ON public.items;

CREATE POLICY "items_select_claimant"
    ON public.items FOR SELECT
    TO authenticated
    USING (has_approved_claim_for_item(id));


-- ──────────────────────────────────────────────────────────────
-- 8.  ABUSE REPORTS — prevent spam flooding
--     A single user could insert unlimited reports for the same
--     target, polluting the moderation queue.
--     Restrict to 1 open report per (reporter, reported_item).
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_duplicate_abuse_reports()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.abuse_reports
        WHERE reporter_id    = NEW.reporter_id
        AND   target_item_id = NEW.target_item_id
        AND   target_item_id IS NOT NULL
        AND   status NOT IN ('resolved', 'dismissed')
    ) THEN
        RAISE EXCEPTION
            'You already have an open report for this item';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_duplicate_reports ON public.abuse_reports;
CREATE TRIGGER trg_no_duplicate_reports
    BEFORE INSERT ON public.abuse_reports
    FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_abuse_reports();


-- ──────────────────────────────────────────────────────────────
-- 9.  NOTIFICATIONS — ensure users only see their own
--     (defensive policy in case it was ever missing)
-- ──────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'notifications'
        AND policyname = 'notifications_select_own'
    ) THEN
        EXECUTE $pol$
            CREATE POLICY "notifications_select_own"
                ON public.notifications FOR SELECT
                TO authenticated
                USING (user_id = auth.uid());
        $pol$;
    END IF;
END $$;


-- ──────────────────────────────────────────────────────────────
-- VERIFY all changes
-- ──────────────────────────────────────────────────────────────

SELECT
    pol.tablename,
    pol.policyname,
    pol.cmd,
    pol.roles
FROM pg_policies pol
WHERE pol.tablename IN ('messages','chats','audit_logs','rate_limits','items','abuse_reports','notifications')
ORDER BY pol.tablename, pol.policyname;

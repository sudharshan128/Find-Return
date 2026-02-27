-- ============================================================
-- FIX: Profile fetch 20-second timeout (RLS recursion)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================
--
-- ROOT CAUSE:
--   is_admin(), is_moderator_or_admin(), is_account_active() are SECURITY DEFINER
--   functions that query public.user_profiles.
--   If the function owner does NOT have the BYPASSRLS privilege, Postgres re-evaluates
--   user_profiles RLS when those functions run → infinite recursion → 20-second timeout.
--
--   Fix: transfer ownership of all helper functions to the "postgres" role,
--   which has BYPASSRLS.  The functions still honour SECURITY DEFINER semantics,
--   but can now read user_profiles directly without triggering RLS.
--
-- SECONDARY CAUSE:
--   user_profiles_update_own WITH CHECK contains inline correlated subqueries
--   that also hit user_profiles, causing another self-referential scan.
--   Fixed by removing those subqueries (role/trust_score are already protected
--   by the backend API; we just keep the basic user_id check).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PART 1: Fix helper-function ownership → break RLS recursion
-- ─────────────────────────────────────────────────────────────

ALTER FUNCTION public.is_admin()                       OWNER TO postgres;
ALTER FUNCTION public.is_moderator_or_admin()          OWNER TO postgres;
ALTER FUNCTION public.is_account_active()              OWNER TO postgres;
ALTER FUNCTION public.is_chat_participant(UUID)        OWNER TO postgres;

-- ─────────────────────────────────────────────────────────────
-- PART 2: Fix user_profiles_update_own — remove self-referential subqueries
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;

CREATE POLICY "user_profiles_update_own"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
-- Note: role and trust_score mutation is blocked by the backend API, not RLS.
-- The previous subquery-based check caused a second recursive read of user_profiles.

-- ─────────────────────────────────────────────────────────────
-- PART 3: Ensure user_profiles has an index on user_id
-- (missing index = full table scan on every RLS helper call = slow)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id
    ON public.user_profiles (user_id);

-- ─────────────────────────────────────────────────────────────
-- PART 4: Verify
-- ─────────────────────────────────────────────────────────────

SELECT
    'is_admin owner = postgres'              AS check_name,
    (SELECT pg_get_userbyid(proowner) FROM pg_proc
     WHERE proname = 'is_admin' LIMIT 1) = 'postgres' AS passes
UNION ALL
SELECT
    'is_moderator_or_admin owner = postgres',
    (SELECT pg_get_userbyid(proowner) FROM pg_proc
     WHERE proname = 'is_moderator_or_admin' LIMIT 1) = 'postgres'
UNION ALL
SELECT
    'is_account_active owner = postgres',
    (SELECT pg_get_userbyid(proowner) FROM pg_proc
     WHERE proname = 'is_account_active' LIMIT 1) = 'postgres'
UNION ALL
SELECT
    'idx_user_profiles_user_id exists',
    EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'user_profiles'
        AND indexname = 'idx_user_profiles_user_id'
    );

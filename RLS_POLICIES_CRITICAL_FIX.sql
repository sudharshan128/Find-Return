-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- CRITICAL: These policies were missing from the schema!
-- Without these, all queries return empty results
-- ============================================================

-- ============================================================
-- 1. USER_PROFILES POLICIES
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view profiles
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.user_profiles;
CREATE POLICY "Public profiles are viewable"
    ON public.user_profiles FOR SELECT
    USING (true);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================================
-- 2. ITEMS POLICIES
-- ============================================================

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Anyone can view active items
DROP POLICY IF EXISTS "Items are viewable by everyone" ON public.items;
CREATE POLICY "Items are viewable by everyone"
    ON public.items FOR SELECT
    USING (true);

-- Authenticated users can create items
DROP POLICY IF EXISTS "Authenticated users can create items" ON public.items;
CREATE POLICY "Authenticated users can create items"
    ON public.items FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = finder_id);

-- Users can update their own items
DROP POLICY IF EXISTS "Users can update own items" ON public.items;
CREATE POLICY "Users can update own items"
    ON public.items FOR UPDATE
    USING (auth.uid() = finder_id);

-- ============================================================
-- 3. ITEM_IMAGES POLICIES
-- ============================================================

ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view images
DROP POLICY IF EXISTS "Images are viewable by everyone" ON public.item_images;
CREATE POLICY "Images are viewable by everyone"
    ON public.item_images FOR SELECT
    USING (true);

-- Item owners can insert images
DROP POLICY IF EXISTS "Item owners can insert images" ON public.item_images;
CREATE POLICY "Item owners can insert images"
    ON public.item_images FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_images.item_id
            AND items.finder_id = auth.uid()
        )
    );

-- Item owners can delete their images
DROP POLICY IF EXISTS "Item owners can delete images" ON public.item_images;
CREATE POLICY "Item owners can delete images"
    ON public.item_images FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_images.item_id
            AND items.finder_id = auth.uid()
        )
    );

-- ============================================================
-- 4. CLAIMS POLICIES
-- ============================================================

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Users can view their own claims
DROP POLICY IF EXISTS "Users can view own claims" ON public.claims;
CREATE POLICY "Users can view own claims"
    ON public.claims FOR SELECT
    USING (auth.uid() = claimant_id);

-- Item owners can view claims on their items
DROP POLICY IF EXISTS "Item owners can view claims" ON public.claims;
CREATE POLICY "Item owners can view claims"
    ON public.claims FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = claims.item_id
            AND items.finder_id = auth.uid()
        )
    );

-- Authenticated users can create claims
DROP POLICY IF EXISTS "Authenticated users can create claims" ON public.claims;
CREATE POLICY "Authenticated users can create claims"
    ON public.claims FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = claimant_id);

-- Item owners can update claims status
DROP POLICY IF EXISTS "Item owners can update claim status" ON public.claims;
CREATE POLICY "Item owners can update claim status"
    ON public.claims FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = claims.item_id
            AND items.finder_id = auth.uid()
        )
    );

-- ============================================================
-- 5. CLAIM_VERIFICATION_ANSWERS POLICIES
-- ============================================================

ALTER TABLE public.claim_verification_answers ENABLE ROW LEVEL SECURITY;

-- Item owners can view answers
DROP POLICY IF EXISTS "Item owners can view answers" ON public.claim_verification_answers;
CREATE POLICY "Item owners can view answers"
    ON public.claim_verification_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.claims
            JOIN public.items ON items.id = claims.item_id
            WHERE claims.id = claim_verification_answers.claim_id
            AND items.finder_id = auth.uid()
        )
    );

-- Claimants can view their own answers
DROP POLICY IF EXISTS "Claimants can view own answers" ON public.claim_verification_answers;
CREATE POLICY "Claimants can view own answers"
    ON public.claim_verification_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.claims
            WHERE claims.id = claim_verification_answers.claim_id
            AND claims.claimant_id = auth.uid()
        )
    );

-- Claimants can insert answers
DROP POLICY IF EXISTS "Claimants can insert answers" ON public.claim_verification_answers;
CREATE POLICY "Claimants can insert answers"
    ON public.claim_verification_answers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.claims
            WHERE claims.id = claim_verification_answers.claim_id
            AND claims.claimant_id = auth.uid()
        )
    );

-- ============================================================
-- 6. ABUSE_REPORTS POLICIES
-- ============================================================

ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
DROP POLICY IF EXISTS "Users can view own reports" ON public.abuse_reports;
CREATE POLICY "Users can view own reports"
    ON public.abuse_reports FOR SELECT
    USING (auth.uid() = reporter_id);

-- Authenticated users can create reports
DROP POLICY IF EXISTS "Authenticated users can create reports" ON public.abuse_reports;
CREATE POLICY "Authenticated users can create reports"
    ON public.abuse_reports FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = reporter_id);

-- ============================================================
-- 7. AUDIT_LOGS POLICIES
-- ============================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only system can write audit logs (no user policies needed)
-- Users cannot view audit logs (admin only via backend)

-- ============================================================
-- 8. CATEGORIES & AREAS POLICIES (Read-only reference data)
-- ============================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone"
    ON public.categories FOR SELECT
    USING (true);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Areas are viewable by everyone" ON public.areas;
CREATE POLICY "Areas are viewable by everyone"
    ON public.areas FOR SELECT
    USING (true);

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================

-- Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- List all policies
SELECT 
    tablename,
    policyname,
    cmd as operation,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

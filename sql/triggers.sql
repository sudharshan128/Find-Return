-- ============================================
-- DATABASE TRIGGERS & FUNCTIONS
-- Lost & Found Bangalore
-- ============================================

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_items
    BEFORE UPDATE ON public.items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_claims
    BEFORE UPDATE ON public.claims
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_reports
    BEFORE UPDATE ON public.abuse_reports
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- NEW USER TRIGGER (on auth.users insert)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    -- Log the signup
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.id, 'USER_SIGNUP', 'user', NEW.id, jsonb_build_object('email', NEW.email));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ITEM CLAIM COUNT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.update_item_claim_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.items 
        SET claim_count = claim_count + 1
        WHERE id = NEW.item_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.items 
        SET claim_count = claim_count - 1
        WHERE id = OLD.item_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_claim_count
    AFTER INSERT OR DELETE ON public.claims
    FOR EACH ROW EXECUTE FUNCTION public.update_item_claim_count();

-- ============================================
-- CLAIM STATUS CHANGE TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_claim_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- When claim is approved
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Update item status
        UPDATE public.items 
        SET status = 'claimed', claimed_at = NOW()
        WHERE id = NEW.item_id;
        
        -- Enable chat
        NEW.chat_enabled = TRUE;
        NEW.chat_enabled_at = NOW();
        NEW.reviewed_at = NOW();
        
        -- Create chat room
        INSERT INTO public.chats (claim_id, item_id, finder_id, claimant_id)
        SELECT NEW.item_id, NEW.item_id, items.finder_id, NEW.claimant_id
        FROM public.items WHERE id = NEW.item_id;
        
        -- Update user stats
        UPDATE public.users 
        SET claims_approved = claims_approved + 1
        WHERE id = NEW.claimant_id;
        
        -- Log the action
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
        VALUES (auth.uid(), 'CLAIM_APPROVED', 'claim', NEW.id, 
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status)
        );
    END IF;
    
    -- When claim is rejected
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.reviewed_at = NOW();
        
        -- Decrease trust score for rejected claims
        UPDATE public.users 
        SET trust_score = GREATEST(0, trust_score - 5)
        WHERE id = NEW.claimant_id;
        
        -- Log the action
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
        VALUES (auth.uid(), 'CLAIM_REJECTED', 'claim', NEW.id,
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_claim_status_change
    BEFORE UPDATE ON public.claims
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.handle_claim_status_change();

-- ============================================
-- USER STATS UPDATE TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.update_user_stats_on_item()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.users 
        SET items_found = items_found + 1
        WHERE id = NEW.finder_id;
    END IF;
    
    -- When item is closed/returned
    IF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed' THEN
        UPDATE public.users 
        SET items_returned = items_returned + 1
        WHERE id = NEW.finder_id;
        
        -- Increase trust score for successful return
        UPDATE public.users 
        SET trust_score = LEAST(100, trust_score + 10)
        WHERE id = NEW.finder_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_user_stats
    AFTER INSERT OR UPDATE ON public.items
    FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_item();

-- ============================================
-- CHAT MESSAGE TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.update_chat_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chats 
    SET last_message_at = NOW()
    WHERE id = NEW.chat_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_chat_on_message();

-- ============================================
-- ABUSE REPORT AUTO-FLAG TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_abuse_report()
RETURNS TRIGGER AS $$
DECLARE
    v_report_count INTEGER;
BEGIN
    -- Count reports for this entity
    IF NEW.reported_item_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_report_count
        FROM public.abuse_reports
        WHERE reported_item_id = NEW.reported_item_id
        AND status = 'open';
        
        -- Auto-flag item after 3 reports
        IF v_report_count >= 3 THEN
            UPDATE public.items 
            SET is_flagged = TRUE, 
                flag_reason = 'Auto-flagged: Multiple abuse reports',
                flagged_at = NOW()
            WHERE id = NEW.reported_item_id;
        END IF;
    END IF;
    
    IF NEW.reported_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_report_count
        FROM public.abuse_reports
        WHERE reported_user_id = NEW.reported_user_id
        AND status = 'open';
        
        -- Auto-ban user after 5 reports
        IF v_report_count >= 5 THEN
            UPDATE public.users 
            SET is_banned = TRUE,
                ban_reason = 'Auto-banned: Multiple abuse reports',
                banned_at = NOW(),
                banned_until = NOW() + INTERVAL '7 days'
            WHERE id = NEW.reported_user_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_abuse_report
    AFTER INSERT ON public.abuse_reports
    FOR EACH ROW EXECUTE FUNCTION public.handle_abuse_report();

-- ============================================
-- RATE LIMITING FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.record_rate_limit(
    p_action_type TEXT,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.rate_limits (user_id, ip_address, action_type)
    VALUES (auth.uid(), p_ip_address, p_action_type);
    
    -- Clean up old records (older than 1 hour)
    DELETE FROM public.rate_limits
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ENCRYPTION HELPER FUNCTIONS
-- ============================================

-- Encrypt sensitive data
CREATE OR REPLACE FUNCTION public.encrypt_data(p_data TEXT, p_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(p_data, p_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt sensitive data
CREATE OR REPLACE FUNCTION public.decrypt_data(p_data BYTEA, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(p_data, p_key);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SEARCH FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.search_items(
    p_query TEXT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_area_id UUID DEFAULT NULL,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL,
    p_status item_status DEFAULT 'unclaimed',
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    color TEXT,
    brand TEXT,
    found_date DATE,
    found_location TEXT,
    status item_status,
    category_name TEXT,
    area_name TEXT,
    image_url TEXT,
    claim_count INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.title,
        i.description,
        i.color,
        i.brand,
        i.found_date,
        i.found_location,
        i.status,
        c.name AS category_name,
        a.name AS area_name,
        (SELECT ii.public_url FROM public.item_images ii WHERE ii.item_id = i.id AND ii.is_primary = TRUE LIMIT 1) AS image_url,
        i.claim_count,
        i.created_at
    FROM public.items i
    LEFT JOIN public.categories c ON c.id = i.category_id
    LEFT JOIN public.areas a ON a.id = i.area_id
    WHERE 
        i.is_deleted = FALSE
        AND i.is_flagged = FALSE
        AND (p_status IS NULL OR i.status = p_status)
        AND (p_category_id IS NULL OR i.category_id = p_category_id)
        AND (p_area_id IS NULL OR i.area_id = p_area_id)
        AND (p_date_from IS NULL OR i.found_date >= p_date_from)
        AND (p_date_to IS NULL OR i.found_date <= p_date_to)
        AND (p_query IS NULL OR 
            to_tsvector('english', i.title || ' ' || i.description) @@ plainto_tsquery('english', p_query)
            OR i.title ILIKE '%' || p_query || '%'
            OR i.description ILIKE '%' || p_query || '%'
        )
    ORDER BY i.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GET USER CLAIM COUNT FOR ITEM
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_claim_count(p_item_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.claims
    WHERE item_id = p_item_id
    AND claimant_id = auth.uid();
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DUPLICATE IMAGE DETECTION (simplified hash comparison)
-- ============================================

CREATE OR REPLACE FUNCTION public.check_duplicate_image(p_storage_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if same storage path exists
    SELECT EXISTS (
        SELECT 1 FROM public.item_images 
        WHERE storage_path = p_storage_path
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- LOST & FOUND BANGALORE - COMPLETE DATABASE SCHEMA
-- ============================================================
-- Version: 2.0.0
-- Date: 2026-01-06
-- Description: Production-ready schema supporting all frontend/backend features
-- 
-- Run this in Supabase SQL Editor
-- This script is IDEMPOTENT - safe to run multiple times
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- DROP EXISTING OBJECTS (for clean re-run)
-- ============================================================

-- Drop views first
DROP VIEW IF EXISTS public.items_with_details CASCADE;
DROP VIEW IF EXISTS public.user_stats CASCADE;

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS public.image_hashes CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.abuse_reports CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.claim_verification_answers CASCADE;
DROP TABLE IF EXISTS public.claims CASCADE;
DROP TABLE IF EXISTS public.item_images CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.areas CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Drop types
DROP TYPE IF EXISTS item_status CASCADE;
DROP TYPE IF EXISTS claim_status CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS account_status CASCADE;
DROP TYPE IF EXISTS contact_method CASCADE;
DROP TYPE IF EXISTS answer_type CASCADE;

-- ============================================================
-- CUSTOM TYPES / ENUMS
-- ============================================================

-- Item status enum
CREATE TYPE item_status AS ENUM ('active', 'claimed', 'returned', 'expired', 'removed');

-- Claim status enum
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- Report status enum
CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');

-- User role enum
CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator');

-- Account status enum
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned');

-- Contact method enum
CREATE TYPE contact_method AS ENUM ('chat', 'email', 'phone');

-- Verification answer type enum
CREATE TYPE answer_type AS ENUM ('hidden_content', 'unique_mark', 'serial', 'custom');

-- ============================================================
-- TABLE 1: USER_PROFILES
-- ============================================================
-- Extends Supabase auth.users with application-specific data
-- Every authenticated user gets a profile automatically via trigger

CREATE TABLE public.user_profiles (
    -- Primary key references auth.users
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic info (synced from auth)
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    
    -- Role and status
    role user_role DEFAULT 'user' NOT NULL,
    account_status account_status DEFAULT 'active' NOT NULL,
    
    -- Trust system
    trust_score INTEGER DEFAULT 100 CHECK (trust_score >= 0 AND trust_score <= 100),
    
    -- Ban info
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,
    banned_by UUID REFERENCES public.user_profiles(user_id),
    
    -- Statistics (denormalized for performance)
    items_found_count INTEGER DEFAULT 0 NOT NULL,
    items_returned_count INTEGER DEFAULT 0 NOT NULL,
    claims_made_count INTEGER DEFAULT 0 NOT NULL,
    successful_claims_count INTEGER DEFAULT 0 NOT NULL,
    reports_received_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Activity tracking
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_account_status ON public.user_profiles(account_status);
CREATE INDEX idx_user_profiles_trust_score ON public.user_profiles(trust_score);

COMMENT ON TABLE public.user_profiles IS 'User profiles extending auth.users with app-specific data';

-- ============================================================
-- TABLE 2: CATEGORIES
-- ============================================================
-- Predefined categories for lost/found items

CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT, -- Emoji or icon name
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default categories
INSERT INTO public.categories (name, slug, description, icon, display_order) VALUES
    ('Electronics', 'electronics', 'Phones, laptops, tablets, cameras', '📱', 1),
    ('Documents', 'documents', 'ID cards, passports, certificates', '📄', 2),
    ('Wallets & Bags', 'wallets-bags', 'Wallets, purses, backpacks, handbags', '👜', 3),
    ('Keys', 'keys', 'House keys, car keys, bike keys', '🔑', 4),
    ('Jewelry', 'jewelry', 'Rings, necklaces, watches, earrings', '💍', 5),
    ('Clothing', 'clothing', 'Jackets, scarves, caps, shoes', '👕', 6),
    ('Books & Stationery', 'books-stationery', 'Books, notebooks, pens', '📚', 7),
    ('Sports Equipment', 'sports', 'Sports gear, gym equipment', '⚽', 8),
    ('Medical Items', 'medical', 'Glasses, hearing aids, medicines', '🏥', 9),
    ('Pet Items', 'pets', 'Pet collars, leashes, tags', '🐕', 10),
    ('Other', 'other', 'Anything else', '📦', 99);

COMMENT ON TABLE public.categories IS 'Predefined item categories for classification';

-- ============================================================
-- TABLE 3: AREAS (Bangalore Locations)
-- ============================================================
-- Major areas in Bangalore for location-based filtering

CREATE TABLE public.areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    zone TEXT, -- North, South, East, West, Central
    pincode_range TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert Bangalore areas
INSERT INTO public.areas (name, slug, zone, display_order) VALUES
    -- Central Bangalore
    ('MG Road', 'mg-road', 'Central', 1),
    ('Brigade Road', 'brigade-road', 'Central', 2),
    ('Commercial Street', 'commercial-street', 'Central', 3),
    ('Cubbon Park', 'cubbon-park', 'Central', 4),
    ('Shivajinagar', 'shivajinagar', 'Central', 5),
    ('Majestic/Kempegowda', 'majestic', 'Central', 6),
    -- South Bangalore
    ('Koramangala', 'koramangala', 'South', 10),
    ('HSR Layout', 'hsr-layout', 'South', 11),
    ('BTM Layout', 'btm-layout', 'South', 12),
    ('JP Nagar', 'jp-nagar', 'South', 13),
    ('Jayanagar', 'jayanagar', 'South', 14),
    ('Banashankari', 'banashankari', 'South', 15),
    ('Electronic City', 'electronic-city', 'South', 16),
    ('Bannerghatta Road', 'bannerghatta-road', 'South', 17),
    -- North Bangalore
    ('Hebbal', 'hebbal', 'North', 20),
    ('Yelahanka', 'yelahanka', 'North', 21),
    ('RT Nagar', 'rt-nagar', 'North', 22),
    ('Sahakara Nagar', 'sahakara-nagar', 'North', 23),
    ('Nagawara', 'nagawara', 'North', 24),
    -- East Bangalore
    ('Whitefield', 'whitefield', 'East', 30),
    ('Marathahalli', 'marathahalli', 'East', 31),
    ('Indiranagar', 'indiranagar', 'East', 32),
    ('KR Puram', 'kr-puram', 'East', 33),
    ('CV Raman Nagar', 'cv-raman-nagar', 'East', 34),
    ('Old Airport Road', 'old-airport-road', 'East', 35),
    -- West Bangalore
    ('Rajajinagar', 'rajajinagar', 'West', 40),
    ('Malleswaram', 'malleswaram', 'West', 41),
    ('Vijayanagar', 'vijayanagar', 'West', 42),
    ('Yeshwantpur', 'yeshwantpur', 'West', 43),
    ('Nagarbhavi', 'nagarbhavi', 'West', 44),
    -- Special Locations
    ('Kempegowda Airport', 'airport', 'North', 50),
    ('Bangalore City Railway Station', 'railway-station', 'Central', 51),
    ('Majestic Bus Stand', 'bus-stand', 'Central', 52),
    ('Metro Stations', 'metro', 'Central', 53),
    ('Other', 'other', 'Other', 99);

CREATE INDEX idx_areas_zone ON public.areas(zone);

COMMENT ON TABLE public.areas IS 'Bangalore areas for location-based item filtering';

-- ============================================================
-- TABLE 4: ITEMS
-- ============================================================
-- Found items posted by finders

CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Owner (finder)
    finder_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Basic info
    title TEXT NOT NULL CHECK (char_length(title) >= 5 AND char_length(title) <= 100),
    description TEXT CHECK (char_length(description) <= 1000),
    category_id UUID NOT NULL REFERENCES public.categories(id),
    
    -- Location info
    area_id UUID NOT NULL REFERENCES public.areas(id),
    location_details TEXT CHECK (char_length(location_details) <= 500),
    
    -- Item details
    color TEXT,
    brand TEXT,
    date_found DATE NOT NULL,
    
    -- Security verification question (only one, answered by claimant)
    security_question TEXT NOT NULL CHECK (char_length(security_question) >= 10 AND char_length(security_question) <= 500),
    
    -- Contact preference
    contact_method contact_method DEFAULT 'chat' NOT NULL,
    
    -- Status
    status item_status DEFAULT 'active' NOT NULL,
    
    -- Claim tracking
    total_claims INTEGER DEFAULT 0 NOT NULL,
    approved_claim_id UUID, -- Set when a claim is approved
    
    -- Engagement metrics
    view_count INTEGER DEFAULT 0 NOT NULL,
    is_featured BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Moderation
    is_flagged BOOLEAN DEFAULT FALSE NOT NULL,
    flag_reason TEXT,
    flagged_by UUID REFERENCES public.user_profiles(user_id),
    flagged_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days') NOT NULL,
    returned_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_items_finder_id ON public.items(finder_id);
CREATE INDEX idx_items_category_id ON public.items(category_id);
CREATE INDEX idx_items_area_id ON public.items(area_id);
CREATE INDEX idx_items_status ON public.items(status);
CREATE INDEX idx_items_date_found ON public.items(date_found);
CREATE INDEX idx_items_created_at ON public.items(created_at DESC);
CREATE INDEX idx_items_expires_at ON public.items(expires_at);
CREATE INDEX idx_items_is_flagged ON public.items(is_flagged);

-- Full text search index
CREATE INDEX idx_items_search ON public.items USING gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- Composite indexes for common queries
CREATE INDEX idx_items_active_recent ON public.items(status, created_at DESC)
    WHERE status = 'active' AND is_flagged = false;

CREATE INDEX idx_items_area_category ON public.items(area_id, category_id)
    WHERE status = 'active';

COMMENT ON TABLE public.items IS 'Found items posted by finders';

-- ============================================================
-- TABLE 5: ITEM_IMAGES
-- ============================================================
-- Separate table for item images (supports backend's uploadItemImages)

CREATE TABLE public.item_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent item
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    -- Storage reference (Supabase Storage path)
    storage_bucket TEXT DEFAULT 'item-images' NOT NULL,
    storage_path TEXT NOT NULL,
    
    -- Public URL (for quick access)
    image_url TEXT NOT NULL,
    
    -- Image metadata
    is_primary BOOLEAN DEFAULT FALSE NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_item_images_item_id ON public.item_images(item_id);
CREATE INDEX idx_item_images_is_primary ON public.item_images(is_primary) WHERE is_primary = true;

-- Ensure only one primary image per item
CREATE UNIQUE INDEX idx_item_images_primary_unique ON public.item_images(item_id) 
    WHERE is_primary = true;

COMMENT ON TABLE public.item_images IS 'Images for found items stored in Supabase Storage';

-- ============================================================
-- TABLE 6: CLAIMS
-- ============================================================
-- Claims made by potential owners

CREATE TABLE public.claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Claim details
    description TEXT NOT NULL,
    contact_info TEXT NOT NULL,
    
    -- Security answer (encrypted)
    security_answer_encrypted TEXT NOT NULL,
    
    -- Proof of ownership
    proof_description TEXT,
    proof_images TEXT[] DEFAULT '{}', -- Array of storage paths
    
    -- Status
    status claim_status DEFAULT 'pending' NOT NULL,
    
    -- Rejection info
    rejection_reason TEXT,
    rejected_at TIMESTAMPTZ,
    
    -- Approval info
    approved_at TIMESTAMPTZ,
    chat_id UUID, -- Set when claim is approved and chat is created
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Prevent duplicate claims
    UNIQUE(item_id, claimant_id)
);

-- Indexes
CREATE INDEX idx_claims_item_id ON public.claims(item_id);
CREATE INDEX idx_claims_claimant_id ON public.claims(claimant_id);
CREATE INDEX idx_claims_status ON public.claims(status);
CREATE INDEX idx_claims_created_at ON public.claims(created_at DESC);

-- Composite index for pending claims
CREATE INDEX idx_claims_pending ON public.claims(item_id, status)
    WHERE status = 'pending';

COMMENT ON TABLE public.claims IS 'Claims submitted by potential item owners';

-- ============================================================
-- TABLE 7: CLAIM_VERIFICATION_ANSWERS
-- ============================================================
-- Multiple verification answers per claim (for future extensibility)

CREATE TABLE public.claim_verification_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent claim
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    
    -- Answer details
    question_index INTEGER DEFAULT 0 NOT NULL,
    encrypted_answer TEXT NOT NULL,
    answer_type answer_type DEFAULT 'custom' NOT NULL,
    
    -- Verification result
    is_verified BOOLEAN DEFAULT NULL, -- NULL = not yet verified
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.user_profiles(user_id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_claim_answers_claim_id ON public.claim_verification_answers(claim_id);

COMMENT ON TABLE public.claim_verification_answers IS 'Verification answers for claims (extensible)';

-- ============================================================
-- TABLE 8: CHATS
-- ============================================================
-- Private chat rooms between finder and approved claimant

CREATE TABLE public.chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    finder_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Status
    enabled BOOLEAN DEFAULT TRUE NOT NULL, -- For enabling/disabling chat
    is_closed BOOLEAN DEFAULT FALSE NOT NULL,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.user_profiles(user_id),
    close_reason TEXT,
    
    -- Message tracking
    last_message_at TIMESTAMPTZ,
    finder_unread_count INTEGER DEFAULT 0 NOT NULL,
    claimant_unread_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- One chat per claim
    UNIQUE(claim_id)
);

-- Indexes
CREATE INDEX idx_chats_finder_id ON public.chats(finder_id);
CREATE INDEX idx_chats_claimant_id ON public.chats(claimant_id);
CREATE INDEX idx_chats_item_id ON public.chats(item_id);
CREATE INDEX idx_chats_is_closed ON public.chats(is_closed);
CREATE INDEX idx_chats_enabled ON public.chats(enabled);

COMMENT ON TABLE public.chats IS 'Private chat rooms for finder-claimant communication';

-- ============================================================
-- TABLE 9: MESSAGES
-- ============================================================
-- Chat messages between users

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent chat
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    
    -- Sender
    sender_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Content
    message_text TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- text, image, system
    
    -- Read status
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMPTZ,
    
    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    deleted_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_messages_is_read ON public.messages(is_read);

-- Composite index for unread messages
CREATE INDEX idx_messages_chat_unread ON public.messages(chat_id, is_read)
    WHERE is_read = false;

COMMENT ON TABLE public.messages IS 'Chat messages between finder and claimant';

-- ============================================================
-- TABLE 10: ABUSE_REPORTS
-- ============================================================
-- Reports for moderation

CREATE TABLE public.abuse_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reporter
    reporter_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    
    -- Target (at least one must be set)
    target_user_id UUID REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
    target_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    target_claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
    target_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    
    -- Report details
    reason TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT[] DEFAULT '{}',
    
    -- Status
    status report_status DEFAULT 'pending' NOT NULL,
    
    -- Resolution
    reviewed_by UUID REFERENCES public.user_profiles(user_id),
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT,
    action_taken TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_abuse_reports_reporter_id ON public.abuse_reports(reporter_id);
CREATE INDEX idx_abuse_reports_status ON public.abuse_reports(status);
CREATE INDEX idx_abuse_reports_target_user ON public.abuse_reports(target_user_id);
CREATE INDEX idx_abuse_reports_target_item ON public.abuse_reports(target_item_id);
CREATE INDEX idx_abuse_reports_created_at ON public.abuse_reports(created_at DESC);

COMMENT ON TABLE public.abuse_reports IS 'User-submitted abuse reports for moderation';

-- ============================================================
-- TABLE 11: AUDIT_LOGS
-- ============================================================
-- Complete audit trail for security and compliance

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Actor
    user_id UUID REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
    
    -- Action details
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- item, claim, chat, user, etc.
    entity_id UUID,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON public.audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

COMMENT ON TABLE public.audit_logs IS 'Complete audit trail for all actions';

-- ============================================================
-- TABLE 12: RATE_LIMITS
-- ============================================================
-- Track rate limits per user per action

CREATE TABLE public.rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    count INTEGER DEFAULT 0 NOT NULL,
    window_start TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, action_type)
);

CREATE INDEX idx_rate_limits_user_action ON public.rate_limits(user_id, action_type);

COMMENT ON TABLE public.rate_limits IS 'Rate limiting tracker per user per action';

-- ============================================================
-- TABLE 13: IMAGE_HASHES
-- ============================================================
-- Store image hashes for duplicate detection

CREATE TABLE public.image_hashes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    hash_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_image_hashes_hash ON public.image_hashes(hash_value);
CREATE INDEX idx_image_hashes_item ON public.image_hashes(item_id);

COMMENT ON TABLE public.image_hashes IS 'Image perceptual hashes for duplicate detection';

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Handle new user from auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment items_found_count when a new item is posted
CREATE OR REPLACE FUNCTION increment_items_found()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_profiles
    SET items_found_count = items_found_count + 1
    WHERE user_id = NEW.finder_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment item claim count
CREATE OR REPLACE FUNCTION increment_item_claims()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.items 
    SET total_claims = total_claims + 1 
    WHERE public.items.id = NEW.item_id;
    
    UPDATE public.user_profiles 
    SET claims_made_count = claims_made_count + 1 
    WHERE public.user_profiles.user_id = NEW.claimant_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Handle claim approval
CREATE OR REPLACE FUNCTION handle_claim_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_chat_id UUID;
    v_finder_id UUID;
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Get finder ID
        SELECT public.items.finder_id INTO v_finder_id 
        FROM public.items 
        WHERE public.items.id = NEW.item_id;
        
        -- Create chat room
        INSERT INTO public.chats (item_id, claim_id, finder_id, claimant_id)
        VALUES (NEW.item_id, NEW.id, v_finder_id, NEW.claimant_id)
        RETURNING id INTO v_chat_id;
        
        -- Update claim with chat ID
        NEW.chat_id = v_chat_id;
        NEW.approved_at = NOW();
        
        -- Update item status
        UPDATE public.items 
        SET status = 'claimed', approved_claim_id = NEW.id 
        WHERE public.items.id = NEW.item_id;
        
        -- Reject other pending claims
        UPDATE public.claims 
        SET status = 'rejected', rejection_reason = 'Another claim was approved', rejected_at = NOW()
        WHERE public.claims.item_id = NEW.item_id 
        AND public.claims.id != NEW.id 
        AND public.claims.status = 'pending';
        
        -- Update claimant stats
        UPDATE public.user_profiles 
        SET successful_claims_count = successful_claims_count + 1,
            trust_score = LEAST(100, trust_score + 5) 
        WHERE public.user_profiles.user_id = NEW.claimant_id;
    END IF;
    
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.rejected_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Handle item return
CREATE OR REPLACE FUNCTION handle_item_return()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'returned' AND OLD.status = 'claimed' THEN
        NEW.returned_at = NOW();
        
        -- Update finder stats
        UPDATE public.user_profiles 
        SET items_returned_count = items_returned_count + 1,
            trust_score = LEAST(100, trust_score + 10) 
        WHERE public.user_profiles.user_id = NEW.finder_id;
        
        -- Close chat
        UPDATE public.chats 
        SET is_closed = TRUE, closed_at = NOW(), close_reason = 'Item returned'
        WHERE public.chats.item_id = NEW.id 
        AND public.chats.is_closed = FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update unread counts on new message
CREATE OR REPLACE FUNCTION update_chat_unread_counts()
RETURNS TRIGGER AS $$
DECLARE
    v_finder_id UUID;
    v_claimant_id UUID;
BEGIN
    SELECT finder_id, claimant_id INTO v_finder_id, v_claimant_id 
    FROM public.chats WHERE id = NEW.chat_id;
    
    IF NEW.sender_id = v_finder_id THEN
        UPDATE public.chats 
        SET claimant_unread_count = claimant_unread_count + 1, last_message_at = NOW() 
        WHERE id = NEW.chat_id;
    ELSE
        UPDATE public.chats 
        SET finder_unread_count = finder_unread_count + 1, last_message_at = NOW() 
        WHERE id = NEW.chat_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Encrypt text using pgcrypto
CREATE OR REPLACE FUNCTION encrypt_text(plain_text TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(pgp_sym_encrypt(plain_text, encryption_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt text using pgcrypto
CREATE OR REPLACE FUNCTION decrypt_text(encrypted_text TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(decode(encrypted_text, 'base64'), encryption_key);
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_action_type TEXT,
    p_max_count INTEGER,
    p_window_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_window_start TIMESTAMPTZ;
BEGIN
    SELECT count, window_start INTO v_count, v_window_start
    FROM public.rate_limits
    WHERE user_id = p_user_id AND action_type = p_action_type;
    
    IF NOT FOUND THEN
        INSERT INTO public.rate_limits (user_id, action_type, count, window_start)
        VALUES (p_user_id, p_action_type, 1, NOW());
        RETURN TRUE;
    END IF;
    
    IF v_window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL THEN
        UPDATE public.rate_limits
        SET count = 1, window_start = NOW()
        WHERE user_id = p_user_id AND action_type = p_action_type;
        RETURN TRUE;
    END IF;
    
    IF v_count < p_max_count THEN
        UPDATE public.rate_limits
        SET count = count + 1
        WHERE user_id = p_user_id AND action_type = p_action_type;
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Log audit event
-- Drop existing function first (parameter names may differ)
DROP FUNCTION IF EXISTS log_audit_event(UUID, TEXT, TEXT, UUID, JSONB, JSONB, JSONB);

CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_values JSONB,
    p_new_values JSONB,
    p_metadata JSONB
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id, action, entity_type, entity_id,
        old_values, new_values, metadata
    ) VALUES (
        p_user_id, p_action, p_entity_type, p_entity_id,
        p_old_values, p_new_values, p_metadata
    )
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Expire old items
CREATE OR REPLACE FUNCTION expire_old_items()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE public.items
    SET status = 'expired'
    WHERE status = 'active' AND expires_at < NOW();
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON public.items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at
    BEFORE UPDATE ON public.claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON public.chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_abuse_reports_updated_at
    BEFORE UPDATE ON public.abuse_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auth user creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Item creation trigger (increments items_found_count for the finder)
CREATE TRIGGER on_item_created
    AFTER INSERT ON public.items
    FOR EACH ROW EXECUTE FUNCTION increment_items_found();

-- Claim creation trigger
CREATE TRIGGER on_claim_created
    AFTER INSERT ON public.claims
    FOR EACH ROW EXECUTE FUNCTION increment_item_claims();

-- Claim status change trigger
CREATE TRIGGER on_claim_status_change
    BEFORE UPDATE OF status ON public.claims
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_claim_approval();

-- Item return trigger
CREATE TRIGGER on_item_return
    BEFORE UPDATE OF status ON public.items
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_item_return();

-- Message unread count trigger
CREATE TRIGGER on_message_created
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_unread_counts();

-- ============================================================
-- VIEWS
-- ============================================================

-- Items with joined details
CREATE OR REPLACE VIEW public.items_with_details AS
SELECT 
    i.*,
    c.name AS category_name,
    c.slug AS category_slug,
    c.icon AS category_icon,
    a.name AS area_name,
    a.slug AS area_slug,
    a.zone AS area_zone,
    u.full_name AS finder_name,
    u.avatar_url AS finder_avatar,
    u.trust_score AS finder_trust_score,
    (SELECT image_url FROM public.item_images WHERE item_id = i.id AND is_primary = true LIMIT 1) AS primary_image
FROM public.items i
JOIN public.categories c ON i.category_id = c.id
JOIN public.areas a ON i.area_id = a.id
JOIN public.user_profiles u ON i.finder_id = u.user_id;

-- User statistics view
CREATE OR REPLACE VIEW public.user_stats AS
SELECT 
    u.user_id,
    u.full_name,
    u.avatar_url,
    u.trust_score,
    u.items_found_count,
    u.items_returned_count,
    u.claims_made_count,
    u.successful_claims_count,
    u.reports_received_count,
    CASE 
        WHEN u.items_found_count > 0 
        THEN ROUND((u.items_returned_count::DECIMAL / u.items_found_count) * 100, 1)
        ELSE 0 
    END AS return_rate,
    CASE 
        WHEN u.claims_made_count > 0 
        THEN ROUND((u.successful_claims_count::DECIMAL / u.claims_made_count) * 100, 1)
        ELSE 0 
    END AS claim_success_rate,
    u.created_at,
    u.last_active_at
FROM public.user_profiles u;

-- ============================================================
-- GRANTS
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.areas TO anon, authenticated;
GRANT SELECT ON public.items TO anon, authenticated;
GRANT SELECT ON public.item_images TO anon, authenticated;
GRANT ALL ON public.items TO authenticated;
GRANT ALL ON public.item_images TO authenticated;
GRANT ALL ON public.claims TO authenticated;
GRANT ALL ON public.claim_verification_answers TO authenticated;
GRANT ALL ON public.chats TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.abuse_reports TO authenticated;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.items_with_details TO anon, authenticated;
GRANT SELECT ON public.user_stats TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;

-- ============================================================
-- DONE
-- ============================================================

COMMENT ON SCHEMA public IS 'Lost & Found Bangalore - Database Schema v2.0.0';

SELECT 'Schema setup complete!' AS status;

-- ============================================
-- LOST & FOUND BANGALORE - COMPLETE DATABASE SCHEMA
-- Supabase PostgreSQL with RLS
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE user_role AS ENUM ('user', 'finder', 'admin');
CREATE TYPE item_status AS ENUM ('unclaimed', 'claimed', 'closed', 'flagged', 'deleted');
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
CREATE TYPE report_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');
CREATE TYPE report_type AS ENUM ('spam', 'fraud', 'inappropriate', 'duplicate', 'other');

-- ============================================
-- USERS TABLE (extends auth.users)
-- ============================================

CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    role user_role DEFAULT 'user',
    trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
    items_found INTEGER DEFAULT 0,
    items_returned INTEGER DEFAULT 0,
    claims_made INTEGER DEFAULT 0,
    claims_approved INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,
    banned_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    last_ip TEXT,
    device_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CATEGORIES TABLE
-- ============================================

CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO public.categories (name, icon, description, sort_order) VALUES
    ('Electronics', '📱', 'Phones, laptops, tablets, chargers', 1),
    ('Wallets & Cards', '💳', 'Wallets, purses, credit cards, IDs', 2),
    ('Documents', '📄', 'Aadhar, PAN, licenses, certificates', 3),
    ('Keys', '🔑', 'House keys, car keys, office keys', 4),
    ('Bags & Luggage', '🎒', 'Backpacks, handbags, suitcases', 5),
    ('Jewelry', '💍', 'Rings, chains, watches, earrings', 6),
    ('Clothing', '👔', 'Jackets, shoes, accessories', 7),
    ('Eyewear', '👓', 'Glasses, sunglasses, cases', 8),
    ('Books & Stationery', '📚', 'Books, notebooks, pens', 9),
    ('Other', '📦', 'Miscellaneous items', 10);

-- ============================================
-- BANGALORE AREAS TABLE
-- ============================================

CREATE TABLE public.areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    zone TEXT NOT NULL, -- North, South, East, West, Central
    pincode TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Bangalore areas
INSERT INTO public.areas (name, zone, pincode) VALUES
    ('Koramangala', 'South', '560034'),
    ('Indiranagar', 'East', '560038'),
    ('Whitefield', 'East', '560066'),
    ('HSR Layout', 'South', '560102'),
    ('BTM Layout', 'South', '560076'),
    ('Jayanagar', 'South', '560041'),
    ('JP Nagar', 'South', '560078'),
    ('Marathahalli', 'East', '560037'),
    ('Electronic City', 'South', '560100'),
    ('Hebbal', 'North', '560024'),
    ('Yelahanka', 'North', '560064'),
    ('Malleshwaram', 'West', '560003'),
    ('Rajajinagar', 'West', '560010'),
    ('Basavanagudi', 'South', '560004'),
    ('MG Road', 'Central', '560001'),
    ('Brigade Road', 'Central', '560001'),
    ('Majestic', 'Central', '560009'),
    ('Banashankari', 'South', '560070'),
    ('Vijayanagar', 'West', '560040'),
    ('Kengeri', 'West', '560060'),
    ('Sarjapur', 'East', '560035'),
    ('Bellandur', 'East', '560103'),
    ('KR Puram', 'East', '560036'),
    ('Yeshwantpur', 'North', '560022'),
    ('Peenya', 'North', '560058'),
    ('Other', 'Other', NULL);

-- ============================================
-- ITEMS TABLE
-- ============================================

CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id),
    area_id UUID REFERENCES public.areas(id),
    
    -- Public information (visible to all)
    title TEXT NOT NULL CHECK (char_length(title) <= 100),
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    color TEXT,
    brand TEXT,
    found_date DATE NOT NULL,
    found_location TEXT NOT NULL, -- General location description
    found_landmark TEXT, -- Nearby landmark
    
    -- Item status
    status item_status DEFAULT 'unclaimed',
    
    -- Verification fields (private - only for verification)
    private_notes TEXT, -- Finder's private notes about unique identifiers
    
    -- Statistics
    view_count INTEGER DEFAULT 0,
    claim_count INTEGER DEFAULT 0,
    
    -- Flags
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    flagged_at TIMESTAMPTZ,
    
    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES public.users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- ============================================
-- ITEM IMAGES TABLE
-- ============================================

CREATE TABLE public.item_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    thumbnail_url TEXT,
    original_filename TEXT,
    file_size INTEGER,
    mime_type TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    is_processed BOOLEAN DEFAULT FALSE, -- EXIF stripped, sensitive areas blurred
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLAIMS TABLE
-- ============================================

CREATE TABLE public.claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Claim status
    status claim_status DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.users(id),
    
    -- Claim attempt tracking
    attempt_number INTEGER DEFAULT 1,
    
    -- Communication enabled
    chat_enabled BOOLEAN DEFAULT FALSE,
    chat_enabled_at TIMESTAMPTZ,
    
    -- Unique constraint: max attempts per user per item
    UNIQUE(item_id, claimant_id, attempt_number)
);

-- ============================================
-- CLAIM ANSWERS TABLE (Encrypted verification data)
-- ============================================

CREATE TABLE public.claim_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    
    -- Encrypted answers (using pgcrypto)
    unique_marks TEXT, -- Scratches, dents, stickers
    hidden_contents TEXT, -- What's inside if applicable
    serial_number_encrypted BYTEA, -- Encrypted serial/IMEI
    model_details TEXT,
    additional_proof TEXT,
    
    -- Proof image (optional)
    proof_image_path TEXT,
    proof_image_url TEXT,
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHATS TABLE (Masked communication)
-- ============================================

CREATE TABLE public.chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    finder_id UUID NOT NULL REFERENCES public.users(id),
    claimant_id UUID NOT NULL REFERENCES public.users(id),
    
    -- Chat status
    is_active BOOLEAN DEFAULT TRUE,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.users(id),
    close_reason TEXT,
    
    -- Last activity
    last_message_at TIMESTAMPTZ,
    finder_last_read TIMESTAMPTZ,
    claimant_last_read TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(claim_id)
);

-- ============================================
-- CHAT MESSAGES TABLE
-- ============================================

CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id),
    
    -- Message content
    message TEXT NOT NULL CHECK (char_length(message) <= 1000),
    
    -- Message type
    is_system_message BOOLEAN DEFAULT FALSE,
    
    -- Read status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Moderation
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    
    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ABUSE REPORTS TABLE
-- ============================================

CREATE TABLE public.abuse_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.users(id),
    
    -- What is being reported
    reported_user_id UUID REFERENCES public.users(id),
    reported_item_id UUID REFERENCES public.items(id),
    reported_claim_id UUID REFERENCES public.claims(id),
    reported_message_id UUID REFERENCES public.chat_messages(id),
    
    -- Report details
    report_type report_type NOT NULL,
    description TEXT NOT NULL CHECK (char_length(description) <= 1000),
    evidence_urls TEXT[], -- Array of evidence image URLs
    
    -- Status
    status report_status DEFAULT 'open',
    
    -- Admin handling
    handled_by UUID REFERENCES public.users(id),
    handled_at TIMESTAMPTZ,
    resolution_notes TEXT,
    action_taken TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    
    -- Action details
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'item', 'claim', 'user', 'chat', etc.
    entity_id UUID,
    
    -- Change data
    old_data JSONB,
    new_data JSONB,
    
    -- Request metadata
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RATE LIMITING TABLE
-- ============================================

CREATE TABLE public.rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    ip_address TEXT,
    action_type TEXT NOT NULL, -- 'item_create', 'claim_create', 'message_send'
    action_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER SESSIONS TABLE (for fingerprinting)
-- ============================================

CREATE TABLE public.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_items_finder ON public.items(finder_id);
CREATE INDEX idx_items_status ON public.items(status);
CREATE INDEX idx_items_category ON public.items(category_id);
CREATE INDEX idx_items_area ON public.items(area_id);
CREATE INDEX idx_items_found_date ON public.items(found_date DESC);
CREATE INDEX idx_items_created ON public.items(created_at DESC);
CREATE INDEX idx_items_search ON public.items USING gin(to_tsvector('english', title || ' ' || description));

CREATE INDEX idx_claims_item ON public.claims(item_id);
CREATE INDEX idx_claims_claimant ON public.claims(claimant_id);
CREATE INDEX idx_claims_status ON public.claims(status);

CREATE INDEX idx_chats_finder ON public.chats(finder_id);
CREATE INDEX idx_chats_claimant ON public.chats(claimant_id);
CREATE INDEX idx_chats_claim ON public.chats(claim_id);

CREATE INDEX idx_messages_chat ON public.chat_messages(chat_id);
CREATE INDEX idx_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX idx_messages_created ON public.chat_messages(created_at DESC);

CREATE INDEX idx_reports_status ON public.abuse_reports(status);
CREATE INDEX idx_reports_type ON public.abuse_reports(report_type);

CREATE INDEX idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);

CREATE INDEX idx_rate_limits_user ON public.rate_limits(user_id, action_type);
CREATE INDEX idx_rate_limits_ip ON public.rate_limits(ip_address, action_type);

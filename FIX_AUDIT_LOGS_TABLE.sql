-- ============================================================
-- FIX AUDIT LOGS TABLE - ADD MISSING COLUMNS
-- ============================================================
-- This updates admin_audit_logs table to match backend expectations
-- and adds cryptographic checksum support
-- ============================================================

-- Step 1: Add missing columns if they don't exist
ALTER TABLE public.admin_audit_logs 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success',
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS target_type TEXT,
ADD COLUMN IF NOT EXISTS target_id TEXT,
ADD COLUMN IF NOT EXISTS checksum TEXT,
ADD COLUMN IF NOT EXISTS previous_checksum TEXT;

-- Step 2: Update existing columns to match backend
-- Rename resource_type to be compatible (keep both for now)
DO $$ 
BEGIN
    -- Copy resource_type to target_type if target_type is null
    UPDATE public.admin_audit_logs 
    SET target_type = resource_type 
    WHERE target_type IS NULL;
    
    -- Copy resource_id to target_id if target_id is null
    UPDATE public.admin_audit_logs 
    SET target_id = resource_id 
    WHERE target_id IS NULL;
    
    -- Copy before_data and after_data into details JSONB
    UPDATE public.admin_audit_logs 
    SET details = jsonb_build_object(
        'before', COALESCE(before_data, '{}'::jsonb),
        'after', COALESCE(after_data, '{}'::jsonb),
        'reason', reason
    )
    WHERE details = '{}'::jsonb;
END $$;

-- Step 3: Create function to calculate checksum
CREATE OR REPLACE FUNCTION calculate_audit_checksum(
    p_id UUID,
    p_admin_id UUID,
    p_action TEXT,
    p_target_type TEXT,
    p_target_id TEXT,
    p_created_at TIMESTAMPTZ,
    p_previous_checksum TEXT
) RETURNS TEXT AS $$
BEGIN
    -- Simple hash of critical fields for integrity verification
    RETURN encode(
        digest(
            p_id::TEXT || 
            p_admin_id::TEXT || 
            p_action || 
            COALESCE(p_target_type, '') || 
            COALESCE(p_target_id, '') || 
            p_created_at::TEXT ||
            COALESCE(p_previous_checksum, ''),
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Create trigger to auto-calculate checksums
CREATE OR REPLACE FUNCTION audit_log_checksum_trigger() RETURNS TRIGGER AS $$
DECLARE
    v_previous_checksum TEXT;
BEGIN
    -- Get the checksum of the most recent log entry
    SELECT checksum INTO v_previous_checksum
    FROM public.admin_audit_logs
    WHERE created_at < NEW.created_at
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Calculate checksum for new entry
    NEW.previous_checksum := v_previous_checksum;
    NEW.checksum := calculate_audit_checksum(
        NEW.id,
        NEW.admin_id,
        NEW.action,
        NEW.target_type,
        NEW.target_id,
        NEW.created_at,
        v_previous_checksum
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS audit_log_checksum_trigger ON public.admin_audit_logs;
CREATE TRIGGER audit_log_checksum_trigger
    BEFORE INSERT ON public.admin_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_checksum_trigger();

-- Step 5: Backfill checksums for existing entries
DO $$
DECLARE
    v_log RECORD;
    v_previous_checksum TEXT := NULL;
BEGIN
    FOR v_log IN 
        SELECT id, admin_id, action, target_type, target_id, created_at
        FROM public.admin_audit_logs
        ORDER BY created_at ASC
    LOOP
        UPDATE public.admin_audit_logs
        SET 
            previous_checksum = v_previous_checksum,
            checksum = calculate_audit_checksum(
                v_log.id,
                v_log.admin_id,
                v_log.action,
                v_log.target_type,
                v_log.target_id,
                v_log.created_at,
                v_previous_checksum
            )
        WHERE id = v_log.id;
        
        v_previous_checksum := calculate_audit_checksum(
            v_log.id,
            v_log.admin_id,
            v_log.action,
            v_log.target_type,
            v_log.target_id,
            v_log.created_at,
            v_previous_checksum
        );
    END LOOP;
END $$;

-- Step 6: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_type ON public.admin_audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_status ON public.admin_audit_logs(status);

-- Step 7: Create helper function to log admin actions
-- Query and drop ALL existing versions of the function
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'log_admin_action'
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.oid::regprocedure || ' CASCADE';
    END LOOP;
END $$;

CREATE FUNCTION log_admin_action(
    p_admin_id UUID,
    p_action TEXT,
    p_target_type TEXT,
    p_target_id TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.admin_audit_logs (
        admin_id,
        action,
        target_type,
        target_id,
        resource_type,
        resource_id,
        resource_action,
        reason,
        status,
        details,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_admin_id,
        p_action,
        p_target_type,
        p_target_id,
        p_target_type,
        p_target_id,
        p_action,
        p_reason,
        'success',
        p_details,
        p_ip_address,
        p_user_agent,
        NOW()
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Grant permissions
GRANT EXECUTE ON FUNCTION log_admin_action TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_audit_checksum TO authenticated;

-- Step 9: Verify the schema
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'admin_audit_logs'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 10: Show sample of existing logs (if any)
SELECT 
    COUNT(*) as total_logs,
    COUNT(DISTINCT admin_id) as unique_admins,
    COUNT(DISTINCT action) as unique_actions,
    MIN(created_at) as first_log,
    MAX(created_at) as last_log
FROM public.admin_audit_logs;

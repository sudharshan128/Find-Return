-- Complete System Settings Setup
-- This script sets up all system settings with proper types

-- First, ensure the table has all necessary columns
DO $$ 
BEGIN
  -- Add setting_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_settings' 
    AND column_name = 'setting_type'
  ) THEN
    ALTER TABLE system_settings 
    ADD COLUMN setting_type TEXT DEFAULT 'string';
  END IF;
END $$;

-- Clear existing settings (if any)
TRUNCATE TABLE system_settings CASCADE;

-- Insert all settings with proper types (values stored as JSONB)
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_sensitive)
VALUES
  -- General Settings
  ('platform_name', '"Lost & Found Bangalore"', 'string', 'The name displayed across the platform', false),
  ('contact_email', '"support@lostfound.in"', 'string', 'Primary contact email for support inquiries', false),
  ('default_trust_score', '50', 'number', 'Initial trust score for new users', false),
  ('enable_registration', 'true', 'boolean', 'Allow new users to register on the platform', false),
  ('maintenance_mode', 'false', 'boolean', 'Put the platform in maintenance mode', false),
  
  -- Security Settings
  ('require_email_verification', 'true', 'boolean', 'Users must verify email before accessing features', false),
  ('enable_2fa', 'true', 'boolean', 'Allow users to enable 2FA for their accounts', false),
  ('max_login_attempts', '5', 'number', 'Lock account after this many failed attempts', false),
  ('admin_session_timeout', '30', 'number', 'Automatically log out admins after inactivity (minutes)', false),
  ('user_session_timeout', '60', 'number', 'Automatically log out users after inactivity (minutes)', false),
  ('admin_ip_allowlist', '""', 'string', 'Comma-separated list of allowed IP addresses (empty = all allowed)', false),
  
  -- Notification Settings  
  ('enable_email_notifications', 'true', 'boolean', 'Send email notifications to users', false),
  ('enable_push_notifications', 'true', 'boolean', 'Send browser push notifications', false),
  ('daily_digest_time', '"09:00"', 'string', 'Time to send daily digest emails (24h format)', false),
  ('admin_alert_email', '""', 'string', 'Email for critical admin alerts', false),
  
  -- Limits & Quotas
  ('max_items_per_user', '10', 'number', 'Maximum number of active items a user can post', false),
  ('max_claims_per_day', '5', 'number', 'Maximum claims a user can make per day', false),
  ('max_images_per_item', '5', 'number', 'Maximum number of images per item listing', false),
  ('max_image_size_mb', '5', 'number', 'Maximum file size for uploaded images (MB)', false),
  ('min_trust_for_posting', '10', 'number', 'Minimum trust score required to post items', false),
  ('item_expiry_days', '90', 'number', 'Days before an unclaimed item expires', false),
  ('report_alert_threshold', '10', 'number', 'Alert admins when pending reports exceed this number', false),
  
  -- Maintenance Settings
  ('enable_auto_cleanup', 'true', 'boolean', 'Automatically cleanup expired items and old data', false),
  ('cleanup_retention_days', '30', 'number', 'Days to retain soft-deleted data before permanent removal', false),
  ('audit_log_retention_days', '0', 'number', 'Days to keep audit logs (0 = forever)', false),
  ('maintenance_message', '"We are currently performing maintenance. Please check back soon."', 'string', 'Message displayed during maintenance mode', false)
ON CONFLICT (setting_key) 
DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  setting_type = EXCLUDED.setting_type,
  description = EXCLUDED.description,
  is_sensitive = EXCLUDED.is_sensitive,
  updated_at = NOW();

-- Verify the data
SELECT 
  setting_key,
  setting_value,
  setting_type,
  description,
  is_sensitive
FROM system_settings
ORDER BY setting_key;

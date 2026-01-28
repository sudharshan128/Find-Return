-- Test if maintenance mode is working
-- Run this to enable maintenance mode
UPDATE system_settings 
SET setting_value = 'true'
WHERE setting_key = 'maintenance_mode';

-- Verify it was set
SELECT setting_key, setting_value, setting_type
FROM system_settings
WHERE setting_key = 'maintenance_mode';

-- To disable maintenance mode, run:
-- UPDATE system_settings SET setting_value = 'false' WHERE setting_key = 'maintenance_mode';

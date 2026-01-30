/**
 * Settings Middleware
 * Enforces system settings across the application
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';

// Cache for settings to avoid DB calls on every request
let settingsCache: Map<string, any> = new Map();
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get a setting value from cache or database
 */
async function getSetting(key: string): Promise<any> {
  const now = Date.now();
  
  // Refresh cache if expired
  if (now - lastCacheUpdate > CACHE_TTL) {
    console.log('[SETTINGS] Cache expired, refreshing from database...');
    try {
      const { data, error } = await supabase
        .getServiceClient()
        .from('system_settings')
        .select('setting_key, setting_value, setting_type');
      
      if (error) {
        console.error('[SETTINGS] Database query error:', error);
      }
      
      if (!error && data) {
        console.log('[SETTINGS] Loaded', data.length, 'settings from database');
        settingsCache.clear();
        data.forEach((setting: any) => {
          console.log('[SETTINGS] Caching:', setting.setting_key, '=', setting.setting_value, 'type:', typeof setting.setting_value);
          settingsCache.set(setting.setting_key, {
            value: setting.setting_value,
            type: setting.setting_type
          });
        });
        lastCacheUpdate = now;
      }
    } catch (error) {
      console.error('[SETTINGS] Cache refresh error:', error);
    }
  }
  
  const setting = settingsCache.get(key);
  const value = setting ? setting.value : null;
  console.log('[SETTINGS] getSetting(' + key + ') returning:', value, 'type:', typeof value);
  return value;
}

/**
 * Manually clear the settings cache
 * Call this after updating settings
 */
export function clearSettingsCache() {
  settingsCache.clear();
  lastCacheUpdate = 0;
}

/**
 * Middleware: Check if maintenance mode is enabled
 * Blocks all non-admin requests if maintenance mode is active
 */
export async function checkMaintenanceMode(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Skip for admin routes
    if (req.path.startsWith('/api/admin')) {
      console.log('[MAINTENANCE] Skipping check for admin route:', req.path);
      return next();
    }

    // Skip for base health check endpoint only (not /api/health)
    if (req.path === '/health') {
      return next();
    }

    const maintenanceMode = await getSetting('maintenance_mode');
    console.log('[MAINTENANCE] Checking maintenance mode for', req.path, '- Value:', maintenanceMode, 'Type:', typeof maintenanceMode);
    
    if (maintenanceMode === true) {
      const message = await getSetting('maintenance_message') || 
        'We are currently performing maintenance. Please check back soon.';
      
      console.log('[MAINTENANCE] Blocking request - maintenance mode is ON');
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message,
        maintenance: true,
        code: 'MAINTENANCE_MODE'
      });
    }

    next();
  } catch (error) {
    console.error('[SETTINGS] Maintenance check error:', error);
    next(); // Continue on error to avoid blocking the site
  }
}

/**
 * Middleware: Check if registration is enabled
 */
export async function checkRegistrationEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const enableRegistration = await getSetting('enable_registration');
    
    if (enableRegistration === false) {
      res.status(403).json({
        error: 'Registration is currently disabled',
        code: 'REGISTRATION_DISABLED'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[SETTINGS] Registration check error:', error);
    next();
  }
}

/**
 * Get all settings (for use in route handlers)
 */
export async function getAllSettings(): Promise<Map<string, any>> {
  // Force cache refresh
  settingsCache.clear();
  lastCacheUpdate = 0;
  
  await getSetting('platform_name'); // Trigger cache refresh
  return settingsCache;
}

/**
 * Get a specific setting value
 */
export { getSetting };

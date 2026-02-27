/**
 * Custom hook to fetch and manage system settings
 * Provides easy access to platform_name, contact_email, etc.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const settingsCache = {
  data: null,
  timestamp: 0,
  ttl: 30000, // 30 seconds cache
  pending: null, // in-flight promise dedup
};

export const useSettings = () => {
  const [settings, setSettings] = useState({
    platform_name: 'Lost & Found Bangalore',
    contact_email: 'support@lostfound.in',
    loading: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      // Check cache first
      const now = Date.now();
      if (settingsCache.data && (now - settingsCache.timestamp) < settingsCache.ttl) {
        console.log('[useSettings] Using cached settings');
        setSettings({ ...settingsCache.data, loading: false });
        return;
      }

      // Reuse an in-flight request if one is already pending
      if (!settingsCache.pending) {
        settingsCache.pending = (async () => {

          try {
            console.log('[useSettings] Fetching settings from database...');
            const { data, error } = await supabase
              .from('system_settings')
              .select('setting_key, setting_value')
              .in('setting_key', ['platform_name', 'contact_email']);

            if (error) throw error;

            const settingsMap = {};
            data.forEach(item => {
              settingsMap[item.setting_key] = item.setting_value;
            });

            const newSettings = {
              platform_name: settingsMap.platform_name || 'Lost & Found Bangalore',
              contact_email: settingsMap.contact_email || 'support@lostfound.in',
              loading: false,
            };

            settingsCache.data = newSettings;
            settingsCache.timestamp = Date.now();
            console.log('[useSettings] Settings loaded:', newSettings);
            return newSettings;
          } catch (error) {
            console.error('[useSettings] Error fetching settings:', error);
            return {
              platform_name: 'Lost & Found Bangalore',
              contact_email: 'support@lostfound.in',
              loading: false,
            };
          } finally {
            settingsCache.pending = null;
          }
        })();
      }

      // Capture ref before finally-block can null it out
      const inflightPromise = settingsCache.pending;
      try {
        const result = await inflightPromise;
        if (result) setSettings(result);
      } catch (_) {
        setSettings({
          platform_name: 'Lost & Found Bangalore',
          contact_email: 'support@lostfound.in',
          loading: false,
        });
      }
    };

    fetchSettings();
  }, []);

  return settings;
};

// Simple helper to get settings synchronously (uses cache)
export const getSettings = () => {
  if (settingsCache.data) {
    return settingsCache.data;
  }
  return {
    platform_name: 'Lost & Found Bangalore',
    contact_email: 'support@lostfound.in',
  };
};

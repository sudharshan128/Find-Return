/**
 * Admin Settings Page
 * System configuration and settings management
 */

import { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import { supabase } from '../lib/adminSupabase';
import {
  Settings,
  Save,
  RefreshCw,
  Shield,
  Bell,
  Globe,
  Users,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminSettingsPage = () => {
  const { isSuperAdmin, adminProfile, loading: authLoading } = useAdminAuth();
  
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Helper to get the value from a setting based on its type
  const getSettingValue = (setting) => {
    console.log('[SETTINGS] Getting value for setting:', setting);
    
    // First check if setting_value exists (new schema)
    if (setting.setting_value !== undefined && setting.setting_value !== null) {
      console.log('[SETTINGS] Using setting_value:', setting.setting_value);
      return setting.setting_value;
    }
    
    // Fall back to typed columns
    switch (setting.setting_type) {
      case 'number': 
        return setting.value_number ?? setting.setting_value ?? 0;
      case 'boolean': 
        return setting.value_boolean ?? setting.setting_value ?? false;
      case 'string': 
        return setting.value_string ?? setting.setting_value ?? '';
      case 'json': 
        return setting.value_json ?? setting.setting_value ?? {};
      default: 
        return setting.value_string ?? setting.setting_value ?? '';
    }
  };

  const fetchSettings = async () => {
    if (authLoading) {
      console.log('[ADMIN SETTINGS] Auth not ready, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('[ADMIN SETTINGS] Fetching settings...');
      setLoading(true);
      setError(null);

      const data = await adminAPIClient.settings.get();
      console.log('[ADMIN SETTINGS] Raw settings data:', data);
      
      // Convert array to object for easier access
      // Use setting_key as the key (database column name)
      const settingsObj = {};
      data.forEach(setting => {
        const value = getSettingValue(setting);
        console.log(`[ADMIN SETTINGS] Setting ${setting.setting_key}:`, value);
        settingsObj[setting.setting_key] = {
          ...setting,
          value: value,
          modified: false,
        };
      });
      console.log('[ADMIN SETTINGS] Processed settings:', settingsObj);
      setSettings(settingsObj);
    } catch (error) {
      console.error('[ADMIN SETTINGS] Error fetching settings:', error);
      setError(error.message || 'Failed to load settings');
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      console.log('[ADMIN SETTINGS] Auth ready. Super admin:', isSuperAdmin());
      fetchSettings();
    }
  }, [authLoading]);

  // Real-time subscription for settings changes
  useEffect(() => {
    console.log('[ADMIN SETTINGS] Setting up real-time subscription...');
    
    const channel = supabase
      .channel('admin-settings-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
        },
        (payload) => {
          console.log('[ADMIN SETTINGS] Real-time update:', payload);
          
          // Update specific setting in local state
          const updatedSetting = payload.new;
          setSettings(prev => ({
            ...prev,
            [updatedSetting.setting_key]: {
              ...prev[updatedSetting.setting_key],
              ...updatedSetting,
              value: getSettingValue(updatedSetting),
              modified: false,
            },
          }));
          
          toast.success(`Setting "${updatedSetting.setting_key}" updated`, { icon: '✅' });
        }
      )
      .subscribe((status) => {
        console.log('[ADMIN SETTINGS] Subscription status:', status);
      });

    return () => {
      console.log('[ADMIN SETTINGS] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSettingChange = (key, value) => {
    console.log('[SETTINGS] Changing setting:', key, 'to', value);
    setSettings(prev => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          value: value,
          modified: true,
        }
      };
      console.log('[SETTINGS] Updated state:', updated[key]);
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      console.log('[SETTINGS] Saving changes...');
      setSaving(true);
      
      // Get all modified settings
      const modifiedSettings = Object.entries(settings)
        .filter(([_, setting]) => setting.modified)
        .map(([key, setting]) => ({
          key,
          value: setting.value,
        }));
      
      console.log('[SETTINGS] Modified settings:', modifiedSettings);
      
      if (modifiedSettings.length === 0) {
        toast.error('No changes to save');
        return;
      }

      const result = await adminAPIClient.settings.update(modifiedSettings);
      console.log('[SETTINGS] Save result:', result);
      
      // Refetch to ensure we have latest values
      await fetchSettings();
      
      toast.success(`${modifiedSettings.length} setting(s) saved successfully`);
    } catch (error) {
      console.error('[SETTINGS] Error saving settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const hasModifiedSettings = Object.values(settings).some(s => s.modified);

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'limits', label: 'Limits & Quotas', icon: Package },
    { id: 'maintenance', label: 'Maintenance', icon: Clock },
  ];

  const renderSettingInput = (settingKey, defaultValue = '', type = 'string') => {
    const setting = settings[settingKey];
    const value = setting?.value ?? defaultValue;
    const isModified = setting?.modified;

    switch (type) {
      case 'boolean':
        return (
          <button
            type="button"
            onClick={() => {
              if (isSuperAdmin()) {
                const newValue = !(value === true || value === 'true');
                handleSettingChange(settingKey, newValue);
              }
            }}
            disabled={!isSuperAdmin()}
            className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-300 ${
              value === true || value === 'true' ? 'bg-indigo-600' : 'bg-gray-200'
            } ${isModified ? 'ring-2 ring-yellow-400' : ''} ${!isSuperAdmin() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white border border-gray-300 transition-transform ${
                value === true || value === 'true' ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleSettingChange(settingKey, parseInt(e.target.value))}
            disabled={!isSuperAdmin()}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${isModified ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'} disabled:bg-gray-100`}
          />
        );
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleSettingChange(settingKey, e.target.value)}
            disabled={!isSuperAdmin()}
            rows={4}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${isModified ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'} disabled:bg-gray-100`}
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleSettingChange(settingKey, e.target.value)}
            disabled={!isSuperAdmin()}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${isModified ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'} disabled:bg-gray-100`}
          >
            {setting?.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleSettingChange(settingKey, e.target.value)}
            disabled={!isSuperAdmin()}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${isModified ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'} disabled:bg-gray-100`}
          />
        );
    }
  };

  const SettingRow = ({ label, description, settingKey, defaultValue, type }) => (
    <div className="py-4 border-b border-gray-200 last:border-0">
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-8">
          <label className="block text-sm font-medium text-gray-900">{label}</label>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <div className="w-64">
          {renderSettingInput(settingKey, defaultValue, type)}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Settings</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchSettings}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500">Configure platform behavior and policies</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchSettings}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          {isSuperAdmin() && (
            <button
              onClick={handleSave}
              disabled={saving || !hasModifiedSettings}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Read-only notice for non-super admins */}
      {!isSuperAdmin() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <Lock className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">View Only</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Only Super Admins can modify system settings. You can view current configurations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modified settings indicator */}
      {hasModifiedSettings && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-700">
              You have unsaved changes. Click "Save Changes" to apply them.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-64 flex-shrink-0">
          <nav className="bg-white rounded-xl shadow-sm overflow-hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 text-indigo-600 border-l-4 border-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'general' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>
              
              <SettingRow
                label="Platform Name"
                description="The name displayed across the platform"
                settingKey="platform_name"
                defaultValue="Lost & Found Bangalore"
                type="string"
              />
              
              <SettingRow
                label="Contact Email"
                description="Primary contact email for support inquiries"
                settingKey="contact_email"
                defaultValue="support@lostfound.in"
                type="string"
              />
              
              <SettingRow
                label="Default Trust Score"
                description="Initial trust score for new users"
                settingKey="default_trust_score"
                defaultValue={50}
                type="number"
              />
              
              <SettingRow
                label="Enable Public Registration"
                description="Allow new users to register on the platform"
                settingKey="enable_registration"
                defaultValue={true}
                type="boolean"
              />
              
              <SettingRow
                label="Maintenance Mode"
                description="Put the platform in maintenance mode"
                settingKey="maintenance_mode"
                defaultValue={false}
                type="boolean"
              />
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h2>
              
              <SettingRow
                label="Require Email Verification"
                description="Users must verify email before accessing features"
                settingKey="require_email_verification"
                defaultValue={true}
                type="boolean"
              />
              
              <SettingRow
                label="Admin Session Timeout (minutes)"
                description="Automatically log out admins after inactivity"
                settingKey="admin_session_timeout"
                defaultValue={30}
                type="number"
              />
              
              <SettingRow
                label="User Session Timeout (minutes)"
                description="Automatically log out users after inactivity"
                settingKey="user_session_timeout"
                defaultValue={60}
                type="number"
              />
              
              <SettingRow
                label="Max Login Attempts"
                description="Lock account after this many failed attempts"
                settingKey="max_login_attempts"
                defaultValue={5}
                type="number"
              />
              
              <SettingRow
                label="Enable Two-Factor Authentication"
                description="Allow users to enable 2FA for their accounts"
                settingKey="enable_2fa"
                defaultValue={true}
                type="boolean"
              />
              
              <SettingRow
                label="Admin IP Allowlist"
                description="Comma-separated list of allowed IP addresses (empty = all allowed)"
                settingKey="admin_ip_allowlist"
                defaultValue=""
                type="textarea"
              />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h2>
              
              <SettingRow
                label="Enable Email Notifications"
                description="Send email notifications to users"
                settingKey="enable_email_notifications"
                defaultValue={true}
                type="boolean"
              />
              
              <SettingRow
                label="Enable Push Notifications"
                description="Send browser push notifications"
                settingKey="enable_push_notifications"
                defaultValue={true}
                type="boolean"
              />
              
              <SettingRow
                label="Admin Alert Email"
                description="Email for critical admin alerts"
                settingKey="admin_alert_email"
                defaultValue=""
                type="string"
              />
              
              <SettingRow
                label="New Report Alert Threshold"
                description="Alert admins when pending reports exceed this number"
                settingKey="report_alert_threshold"
                defaultValue={10}
                type="number"
              />
              
              <SettingRow
                label="Daily Digest Time"
                description="Time to send daily digest emails (24h format)"
                settingKey="daily_digest_time"
                defaultValue="09:00"
                type="string"
              />
            </div>
          )}

          {activeTab === 'limits' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Limits & Quotas</h2>
              
              <SettingRow
                label="Max Items Per User"
                description="Maximum number of active items a user can post"
                settingKey="max_items_per_user"
                defaultValue={10}
                type="number"
              />
              
              <SettingRow
                label="Max Claims Per User Per Day"
                description="Maximum claims a user can make per day"
                settingKey="max_claims_per_day"
                defaultValue={5}
                type="number"
              />
              
              <SettingRow
                label="Max Image Size (MB)"
                description="Maximum file size for uploaded images"
                settingKey="max_image_size_mb"
                defaultValue={5}
                type="number"
              />
              
              <SettingRow
                label="Max Images Per Item"
                description="Maximum number of images per item listing"
                settingKey="max_images_per_item"
                defaultValue={5}
                type="number"
              />
              
              <SettingRow
                label="Item Expiry Days"
                description="Days before an unclaimed item expires"
                settingKey="item_expiry_days"
                defaultValue={90}
                type="number"
              />
              
              <SettingRow
                label="Minimum Trust Score for Posting"
                description="Minimum trust score required to post items"
                settingKey="min_trust_for_posting"
                defaultValue={10}
                type="number"
              />
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Settings</h2>
              
              <SettingRow
                label="Maintenance Message"
                description="Message displayed during maintenance mode"
                settingKey="maintenance_message"
                defaultValue="We're currently performing maintenance. Please check back soon."
                type="textarea"
              />
              
              <SettingRow
                label="Enable Auto Cleanup"
                description="Automatically cleanup expired items and old data"
                settingKey="enable_auto_cleanup"
                defaultValue={true}
                type="boolean"
              />
              
              <SettingRow
                label="Cleanup Retention Days"
                description="Days to retain soft-deleted data before permanent removal"
                settingKey="cleanup_retention_days"
                defaultValue={30}
                type="number"
              />
              
              <SettingRow
                label="Audit Log Retention Days"
                description="Days to keep audit logs (0 = forever)"
                settingKey="audit_log_retention_days"
                defaultValue={0}
                type="number"
              />
              
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">System Information</h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Version</dt>
                    <dd className="font-medium text-gray-900">1.0.0</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Environment</dt>
                    <dd className="font-medium text-gray-900">Production</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Database</dt>
                    <dd className="font-medium text-gray-900">Supabase PostgreSQL</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Region</dt>
                    <dd className="font-medium text-gray-900">ap-south-1</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;

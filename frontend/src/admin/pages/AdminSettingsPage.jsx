/**
 * Admin Settings Page
 * System configuration and settings management
 */

import { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminSettings } from '../lib/adminSupabase';
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
  const { isSuperAdmin, adminProfile } = useAdminAuth();
  
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Helper to get the value from a setting based on its type
  const getSettingValue = (setting) => {
    switch (setting.setting_type) {
      case 'number': return setting.value_number;
      case 'boolean': return setting.value_boolean;
      case 'string': return setting.value_string;
      case 'json': return setting.value_json;
      default: return setting.value_string;
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await adminSettings.getAll();
      
      // Convert array to object for easier access
      // Use setting_key as the key (database column name)
      const settingsObj = {};
      data.forEach(setting => {
        settingsObj[setting.setting_key] = {
          ...setting,
          value: getSettingValue(setting),
          modified: false,
        };
      });
      setSettings(settingsObj);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: value,
        modified: true,
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Get all modified settings
      const modifiedSettings = Object.entries(settings)
        .filter(([_, setting]) => setting.modified)
        .map(([key, setting]) => ({
          key,
          value: setting.value,
        }));
      
      if (modifiedSettings.length === 0) {
        toast.error('No changes to save');
        return;
      }

      await adminSettings.updateMultiple(modifiedSettings, adminProfile?.id);
      
      // Clear modified flags
      const updatedSettings = { ...settings };
      Object.keys(updatedSettings).forEach(key => {
        updatedSettings[key].modified = false;
      });
      setSettings(updatedSettings);
      
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
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
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => handleSettingChange(settingKey, e.target.checked)}
              disabled={!isSuperAdmin()}
              className="sr-only peer"
            />
            <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 ${isModified ? 'ring-2 ring-yellow-400' : ''}`}></div>
          </label>
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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

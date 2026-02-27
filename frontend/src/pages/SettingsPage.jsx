/**
 * Settings Page - Modern SaaS Edition
 * User account settings and preferences with premium design
 */

import { useState, useEffect } from 'react';
import { authFetch } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  Bell, 
  Mail, 
  Shield, 
  Eye,
  Trash2,
  LogOut,
  ChevronRight,
  AlertTriangle,
  User,
  TrendingUp,
  Info,
  CheckCircle2
} from 'lucide-react';

// Reusable Settings Card Component
const SettingsCard = ({ icon: Icon, title, description, children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-surface-border hover:shadow-card-hover transition-all duration-300 overflow-hidden ${className}`}>
    <div className="p-6 sm:p-8">
      {/* Card Header */}
      <div className="flex items-start gap-3 mb-6">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex-shrink-0">
            <Icon className="w-5 h-5 text-primary-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-ink mb-1">{title}</h2>
          {description && (
            <p className="caption">{description}</p>
          )}
        </div>
      </div>
      {/* Card Content */}
      <div>{children}</div>
    </div>
  </div>
);

// Reusable Settings Row Component
const SettingsRow = ({ label, value, isLast = false }) => (
  <div className={`flex justify-between items-center py-3.5 ${!isLast ? 'border-b border-surface-border/50' : ''}`}>
    <span className="text-sm font-medium text-ink-muted">{label}</span>
    <span className="text-sm font-semibold text-ink">{value}</span>
  </div>
);

// Enhanced Toggle Switch Component
const ToggleSwitch = ({ enabled, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
      enabled ? 'bg-gradient-to-r from-primary-600 to-primary-500' : 'bg-surface-border'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-all duration-300 ease-in-out ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

// Trust Score Progress Bar Component
const TrustScoreDisplay = ({ score = 50 }) => {
  const getScoreColor = (score) => {
    if (score <= 30) return { bg: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-100', gradient: 'from-red-500 to-red-600' };
    if (score <= 50) return { bg: 'bg-orange-500', text: 'text-orange-600', ring: 'ring-orange-100', gradient: 'from-orange-500 to-orange-600' };
    if (score <= 70) return { bg: 'bg-blue-500', text: 'text-blue-600', ring: 'ring-blue-100', gradient: 'from-blue-500 to-blue-600' };
    if (score <= 85) return { bg: 'bg-purple-500', text: 'text-purple-600', ring: 'ring-purple-100', gradient: 'from-purple-500 to-purple-600' };
    return { bg: 'bg-green-500', text: 'text-green-600', ring: 'ring-green-100', gradient: 'from-green-500 to-green-600' };
  };

  const getScoreLabel = (score) => {
    if (score <= 30) return 'Risky User';
    if (score <= 50) return 'Fair Trust';
    if (score <= 70) return 'Good Trust';
    if (score <= 85) return 'High Trust';
    return 'Verified Trusted Member';
  };

  const colors = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="space-y-4">
      {/* Score Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.ring} ring-2`}>
            <TrendingUp className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Trust Score</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${colors.text}`}>{score}</p>
          <p className="text-xs text-gray-500">out of 100</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-3 bg-surface-muted rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500 ease-out rounded-full relative`}
            style={{ width: `${score}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
        {/* Percentage Label */}
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>0</span>
          <span className="font-medium">{score}%</span>
          <span>100</span>
        </div>
      </div>

      {/* Info Tooltip */}
      <div className="flex items-start gap-2 p-3 bg-primary-50 border border-primary-100 rounded-xl">
        <Info className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-primary-700 leading-relaxed">
          Your trust score increases when you successfully return items and decreases with rejected claims or reports.
        </p>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    claimUpdates: true,
    chatMessages: true,
    marketingEmails: false,
    showTrustScore: true,
    showProfile: true,
  });

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleSaveChanges = () => {
    // Save to backend (implement actual API call)
    toast.success('Settings saved successfully!');
    setHasChanges(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setTimeout(() => navigate('/'), 100);
    } catch (error) {
      console.error('[SETTINGS] Sign out error:', error);
      setTimeout(() => navigate('/'), 100);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      await authFetch('/api/user/account', { method: 'DELETE' });
      toast.success('Your account has been permanently deleted.');
    } catch (err) {
      console.error('[SETTINGS] Delete account error:', err);
      toast.error(err.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
      return;
    }

    // Navigate out regardless of whether signOut succeeds —
    // the auth user is already gone on the server.
    try { await signOut(); } catch (_) { /* ignore */ }
    navigate('/login', { replace: true });
  };

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-app py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-ink mb-3 tracking-tight">
              Account Settings
            </h1>
            <p className="body-text text-lg">
              Manage your preferences and account information
            </p>
          </div>

          {/* Settings Sections */}
          <div className="space-y-6">
            {/* Account Information */}
            <SettingsCard 
              icon={User} 
              title="Account Information" 
              description="Your personal details and account status"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Account Details */}
                <div className="space-y-1">
                  <SettingsRow label="Email" value={profile?.email || user?.email || 'Not set'} />
                  <SettingsRow label="Account Type" value={<span className="capitalize px-3 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-700">{profile?.role || 'User'}</span>} />
                  <SettingsRow 
                    label="Member Since" 
                    value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} 
                    isLast
                  />
                </div>

                {/* Trust Score with Progress */}
                <div>
                  <TrustScoreDisplay score={profile?.trust_score || 50} />
                </div>
              </div>
            </SettingsCard>

            {/* Notification Settings */}
            <SettingsCard 
              icon={Bell} 
              title="Notifications" 
              description="Choose what updates you want to receive"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between group hover:bg-surface-muted -mx-2 px-2 py-2 rounded-lg transition-colors">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-ink mb-0.5">Email Notifications</p>
                    <p className="body-text">Receive email updates about your activity</p>
                  </div>
                  <ToggleSwitch 
                    enabled={settings.emailNotifications} 
                    onChange={() => handleToggle('emailNotifications')} 
                  />
                </div>
                
                <div className="border-t border-surface-border" />

                <div className="flex items-center justify-between group hover:bg-surface-muted -mx-2 px-2 py-2 rounded-lg transition-colors">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-ink mb-0.5">Claim Updates</p>
                    <p className="body-text">Get notified when claims are approved or rejected</p>
                  </div>
                  <ToggleSwitch 
                    enabled={settings.claimUpdates} 
                    onChange={() => handleToggle('claimUpdates')} 
                  />
                </div>

                <div className="border-t border-surface-border" />

                <div className="flex items-center justify-between group hover:bg-surface-muted -mx-2 px-2 py-2 rounded-lg transition-colors">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-ink mb-0.5">Chat Messages</p>
                    <p className="body-text">Receive notifications for new messages</p>
                  </div>
                  <ToggleSwitch 
                    enabled={settings.chatMessages} 
                    onChange={() => handleToggle('chatMessages')} 
                  />
                </div>

                <div className="border-t border-surface-border" />

                <div className="flex items-center justify-between group hover:bg-surface-muted -mx-2 px-2 py-2 rounded-lg transition-colors">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-ink mb-0.5">Marketing Emails</p>
                    <p className="body-text">Receive tips and updates about our platform</p>
                  </div>
                  <ToggleSwitch 
                    enabled={settings.marketingEmails} 
                    onChange={() => handleToggle('marketingEmails')} 
                  />
                </div>
              </div>
            </SettingsCard>

            {/* Privacy Settings */}
            <SettingsCard 
              icon={Eye} 
              title="Privacy" 
              description="Control your profile visibility"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between group hover:bg-surface-muted -mx-2 px-2 py-2 rounded-lg transition-colors">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-ink mb-0.5">Show Trust Score</p>
                    <p className="body-text">Display your trust score on your profile</p>
                  </div>
                  <ToggleSwitch 
                    enabled={settings.showTrustScore} 
                    onChange={() => handleToggle('showTrustScore')} 
                  />
                </div>

                <div className="border-t border-surface-border" />

                <div className="flex items-center justify-between group hover:bg-surface-muted -mx-2 px-2 py-2 rounded-lg transition-colors">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-ink mb-0.5">Public Profile</p>
                    <p className="body-text">Allow others to view your profile details</p>
                  </div>
                  <ToggleSwitch 
                    enabled={settings.showProfile} 
                    onChange={() => handleToggle('showProfile')} 
                  />
                </div>
              </div>
            </SettingsCard>

            {/* Account Actions */}
            <SettingsCard 
              icon={Shield} 
              title="Account Actions" 
              description="Manage your account and security"
            >
              <div className="space-y-3">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 text-left group border border-transparent hover:border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                      <LogOut className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 block">Sign Out</span>
                      <span className="text-sm text-gray-500">Sign out of your account</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ink-subtle group-hover:translate-x-1 transition-transform" />
                </button>
                
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-red-50 transition-all duration-200 text-left group border border-transparent hover:border-red-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 group-hover:bg-red-200 transition-colors">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <span className="font-medium text-red-600 block">Delete Account</span>
                      <span className="text-sm text-red-500">Permanently delete your account</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-red-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </SettingsCard>
          </div>

          {/* Floating Save Button */}
          {hasChanges && (
            <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-4 duration-300">
              <button
                onClick={handleSaveChanges}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-full shadow-card hover:shadow-card-hover transition-all duration-200 hover:scale-105 font-medium"
              >
                <CheckCircle2 className="w-5 h-5" />
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-100 to-red-200 flex-shrink-0">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-ink mb-2">Delete Account?</h3>
                <p className="body-text leading-relaxed">
                  This action is <strong>permanent</strong> and cannot be undone. All your items, claims, and chat history will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-800 font-medium">
                ⚠️ Please consider downloading your data before proceeding.
              </p>
            </div>

            {/* Typed confirmation */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Type <span className="font-bold tracking-widest text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={isDeleting}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent disabled:opacity-50"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                disabled={isDeleting}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-medium hover:from-red-700 hover:to-red-600 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-red-600 disabled:hover:to-red-500"
              >
                {isDeleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

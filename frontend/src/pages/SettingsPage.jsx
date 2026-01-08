/**
 * Settings Page
 * User account settings and preferences
 */

import { useState } from 'react';
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
  AlertTriangle
} from 'lucide-react';

const SettingsPage = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    toast.success('Setting updated');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleDeleteAccount = () => {
    // For now, just show a message - implement actual deletion later
    toast.error('Account deletion is not yet implemented. Please contact support.');
    setShowDeleteConfirm(false);
  };

  const ToggleSwitch = ({ enabled, onChange }) => (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        enabled ? 'bg-primary-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600 mb-8">Manage your account preferences</p>

        {/* Account Info */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-600" />
            Account Information
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Email</span>
              <span className="font-medium">{profile?.email || user?.email || 'Not set'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Account Type</span>
              <span className="font-medium capitalize">{profile?.role || 'User'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Trust Score</span>
              <span className="font-medium text-primary-600">{profile?.trust_score || 50}/100</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Member Since</span>
              <span className="font-medium">
                {profile?.created_at 
                  ? new Date(profile.created_at).toLocaleDateString() 
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-600" />
            Notifications
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-500">Receive email updates about your activity</p>
              </div>
              <ToggleSwitch 
                enabled={settings.emailNotifications} 
                onChange={() => handleToggle('emailNotifications')} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Claim Updates</p>
                <p className="text-sm text-gray-500">Get notified when claims are approved or rejected</p>
              </div>
              <ToggleSwitch 
                enabled={settings.claimUpdates} 
                onChange={() => handleToggle('claimUpdates')} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Chat Messages</p>
                <p className="text-sm text-gray-500">Receive notifications for new messages</p>
              </div>
              <ToggleSwitch 
                enabled={settings.chatMessages} 
                onChange={() => handleToggle('chatMessages')} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Marketing Emails</p>
                <p className="text-sm text-gray-500">Receive tips and updates about our platform</p>
              </div>
              <ToggleSwitch 
                enabled={settings.marketingEmails} 
                onChange={() => handleToggle('marketingEmails')} 
              />
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary-600" />
            Privacy
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Show Trust Score</p>
                <p className="text-sm text-gray-500">Display your trust score on your profile</p>
              </div>
              <ToggleSwitch 
                enabled={settings.showTrustScore} 
                onChange={() => handleToggle('showTrustScore')} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Public Profile</p>
                <p className="text-sm text-gray-500">Allow others to view your profile details</p>
              </div>
              <ToggleSwitch 
                enabled={settings.showProfile} 
                onChange={() => handleToggle('showProfile')} 
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
          <div className="space-y-2">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Sign Out</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-red-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-600">Delete Account</span>
              </div>
              <ChevronRight className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-full bg-red-100">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Account?</h3>
                  <p className="text-gray-600 mt-1">
                    This action is permanent and cannot be undone. All your items, claims, and chat history will be deleted.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;

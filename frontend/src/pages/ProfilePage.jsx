/**
 * Profile Page
 * View and edit user profile
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Star, Package, CheckCircle, MessageCircle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile(formData);
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrustLevel = (score) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-green-600' };
    if (score >= 60) return { label: 'Good', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Fair', color: 'text-yellow-600' };
    return { label: 'Low', color: 'text-red-600' };
  };

  const trustLevel = getTrustLevel(profile?.trust_score || 50);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

        {/* Profile Card */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <img
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name}&background=3b82f6&color=fff&size=120`}
              alt={profile?.full_name}
              className="w-24 h-24 rounded-full object-cover"
            />

            {/* Info */}
            <div className="flex-1">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      rows={2}
                      className="input w-full"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="btn btn-primary"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="btn btn-secondary"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-gray-900">{profile?.full_name}</h2>
                  <p className="text-gray-500 mb-3">{profile?.email}</p>
                  {profile?.bio && (
                    <p className="text-gray-600 mb-3">{profile.bio}</p>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="btn btn-secondary text-sm"
                  >
                    Edit Profile
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trust Score */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Trust Score</h3>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold text-gray-900">{profile?.trust_score || 50}</span>
              <span className="text-gray-400">/100</span>
            </div>
          </div>

          <div className="mb-3">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (profile?.trust_score || 50) >= 80 ? 'bg-green-500' :
                  (profile?.trust_score || 50) >= 60 ? 'bg-blue-500' :
                  (profile?.trust_score || 50) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${profile?.trust_score || 50}%` }}
              />
            </div>
          </div>

          <p className={`text-sm font-medium ${trustLevel.color}`}>
            {trustLevel.label} Trust Level
          </p>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Your trust score is calculated based on your activity on the platform:
              successful item returns, claim accuracy, and community interactions.
              A higher score unlocks more features and builds trust with other users.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <Package className="w-8 h-8 text-primary-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{profile?.items_found || 0}</p>
            <p className="text-sm text-gray-500">Items Found</p>
          </div>

          <div className="card text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{profile?.items_returned || 0}</p>
            <p className="text-sm text-gray-500">Items Returned</p>
          </div>

          <div className="card text-center">
            <MessageCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{profile?.claims_made || 0}</p>
            <p className="text-sm text-gray-500">Claims Made</p>
          </div>

          <div className="card text-center">
            <Shield className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{profile?.claims_approved || 0}</p>
            <p className="text-sm text-gray-500">Claims Approved</p>
          </div>
        </div>

        {/* Account Info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Account Type</span>
              <span className="font-medium text-gray-900 capitalize">{profile?.role || 'user'}</span>
            </div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Member Since</span>
              <span className="font-medium text-gray-900">
                {profile?.created_at 
                  ? new Date(profile.created_at).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'N/A'
                }
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-gray-500">Email Verified</span>
              <span className="font-medium text-green-600">Yes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

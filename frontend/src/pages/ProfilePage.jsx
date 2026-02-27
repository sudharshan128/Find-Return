/**
 * Profile Page
 * View and edit user profile with real-time trust score tracking
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../lib/supabase';
import { useTrustScore } from '../hooks/useTrustScore';
import TrustScoreProgress from '../components/TrustScoreProgress';
import TrustBadge from '../components/TrustBadge';
import TrustScoreHistory from '../components/TrustScoreHistory';
import { Star, Package, CheckCircle, MessageCircle, Shield, ChevronDown, ChevronUp, TrendingUp, User, Clock, Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { user, profile, updateProfile, refreshProfile, initializing } = useAuth();
  const { trustScore, trustLevel, levelDetails, scoreChange, fetchLogs, trustLogs, logsLoading } = useTrustScore();

  // ── ALL hooks must be declared before any conditional return ──
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Derived display values — fall back to auth metadata so the page
  // never shows blank data even when the DB row hasn't loaded yet.
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    '';
  const displayEmail = profile?.email || user?.email || '';

  // Avatar: prefer uploaded avatar, then Google profile picture, then generated letter avatar
  const avatarSrc =
    avatarPreview ||
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'U')}&background=2563eb&color=fff&size=160`;

  // Fetch live stats from Supabase — only after user is available
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        const data = await db.users.getStats(user.id);
        if (!cancelled) setStats(data);
      } catch (err) {
        console.error('[ProfilePage] Stats fetch error:', err);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    loadStats();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Sync form data when profile loads/changes — keep previous state until fetch completes
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  // Fetch logs when history section is opened
  useEffect(() => {
    if (showHistory) {
      fetchLogs(20);
    }
  }, [showHistory, fetchLogs]);

  // Show a full loading skeleton while auth is still initialising on mount
  if (initializing && !profile) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <div className="w-full max-w-md mx-auto px-4 py-10 space-y-4 animate-pulse">
          <div className="h-24 w-24 rounded-2xl bg-slate-200 mx-auto" />
          <div className="h-6 w-40 bg-slate-200 rounded mx-auto" />
          <div className="h-4 w-56 bg-slate-100 rounded mx-auto" />
          <div className="h-32 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile(formData);
      setEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, WebP, or GIF)');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    try {
      setAvatarUploading(true);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload to Supabase
      const { publicUrl } = await storage.uploadAvatar(file, user.id);

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: publicUrl });
      
      toast.success('Profile photo updated!');
      setAvatarPreview(null);
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(error.message || 'Failed to upload photo');
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero banner ── */}
      <div className="w-full h-36 bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
             style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="container-app">
        <div className="max-w-2xl mx-auto">

          {/* ── Profile header card ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-8 pb-8 -mt-16 mb-6 relative">

            {/* Avatar row */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-5 mb-6">
              <div className="relative flex-shrink-0 -mt-8">
                <div className="relative group">
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-lg"
                  />
                  {/* Camera overlay */}
                  <button
                    onClick={handleAvatarClick}
                    disabled={avatarUploading}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                    title="Change profile photo"
                  >
                    {avatarUploading ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full flex items-center justify-center
                               text-sm shadow border-2 border-white"
                  style={{ backgroundColor: levelDetails.bg, color: levelDetails.color }}
                  title={trustLevel}
                >
                  {levelDetails.icon}
                </div>
              </div>

              {!editing && (
                <div className="sm:flex-1 pt-2 sm:pt-0 sm:pb-1">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <h2 className="text-2xl font-black text-slate-900">{displayName || 'Your Name'}</h2>
                    <TrustBadge trustScore={trustScore} trustLevel={trustLevel} size="small" showTooltip={false} animated />
                  </div>
                  <p className="text-sm text-slate-400">{displayEmail}</p>
                </div>
              )}
            </div>

            {/* Bio + edit toggle */}
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name</label>
                  <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange}
                         className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-slate-800 transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                         className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-slate-800 transition"
                         placeholder="+91 98765 43210" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={loading}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60">
                    {loading ? 'Saving…' : 'Save changes'}
                  </button>
                  <button onClick={() => setEditing(false)} disabled={loading}
                          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {profile?.phone && (
                  <p className="text-sm text-slate-500 mb-4 leading-relaxed">📞 {profile.phone}</p>
                )}
                <button onClick={() => setEditing(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200
                                   text-slate-700 text-sm font-semibold rounded-xl transition-colors">
                  <User className="w-4 h-4" /> Edit Profile
                </button>
              </>
            )}
          </div>

          {/* ── Stats grid ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: <Package className="w-6 h-6 text-blue-500" />,        label: 'Items Found',      value: stats?.items_found_count       ?? 0, bg: 'bg-blue-50',   ring: 'ring-blue-100' },
              { icon: <CheckCircle className="w-6 h-6 text-emerald-500" />,  label: 'Items Returned',   value: stats?.items_returned_count    ?? 0, bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
              { icon: <MessageCircle className="w-6 h-6 text-violet-500" />, label: 'Claims Made',      value: stats?.claims_made_count       ?? 0, bg: 'bg-violet-50', ring: 'ring-violet-100' },
              { icon: <Shield className="w-6 h-6 text-amber-500" />,         label: 'Successful Claims', value: stats?.successful_claims_count ?? 0, bg: 'bg-amber-50',  ring: 'ring-amber-100' },
            ].map(({ icon, label, value, bg, ring }) => (
              <div key={label} className={`${bg} ring-1 ${ring} rounded-2xl p-4 text-center`}>
                <div className="flex justify-center mb-2">{icon}</div>
                {statsLoading
                  ? <div className="h-8 w-8 mx-auto mb-1 rounded-lg bg-slate-200 animate-pulse" />
                  : <p className="text-2xl font-black text-slate-800">{value}</p>}
                <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Trust Score card ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">Trust Score</h3>
              </div>
              <div className="flex items-baseline gap-1">
                {scoreChange !== null && scoreChange !== 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-1 ${
                    scoreChange > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {scoreChange > 0 ? '+' : ''}{scoreChange}
                  </span>
                )}
                <span className="text-3xl font-black" style={{ color: levelDetails.color }}>
                  {trustScore !== null ? trustScore : <span className="inline-block w-10 h-7 bg-slate-200 rounded animate-pulse" />}
                </span>
                <span className="text-slate-400 text-base">/100</span>
              </div>
            </div>

            <TrustScoreProgress
              trustScore={trustScore ?? 0}
              trustLevel={trustLevel}
              previousScore={scoreChange !== null ? (trustScore ?? 0) - scoreChange : undefined}
              animated
              showLabel={false}
            />

            <div className="mt-4 flex items-center justify-between">
              <TrustBadge trustScore={trustScore ?? 0} trustLevel={trustLevel} size="medium" showTooltip animated />
              {(trustScore ?? 0) < 86 && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {86 - (trustScore ?? 0)} pts to next tier
                </p>
              )}
            </div>

            <div className="mt-5 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <p className="text-sm text-slate-600 leading-relaxed">
                <span className="font-semibold text-blue-700">How it works: </span>
                Calculated from email verification, profile completeness, successful returns, claim accuracy,
                and community interactions. Updates in <span className="font-semibold text-slate-700">real-time</span>.
              </p>
            </div>
          </div>

          {/* ── Trust Score History (collapsible) ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="text-base font-bold text-slate-800">Trust Score History</span>
              </div>
              {showHistory
                ? <ChevronUp className="w-5 h-5 text-slate-400" />
                : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            {showHistory && (
              <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                <TrustScoreHistory limit={20} />
              </div>
            )}
          </div>

          {/* ── Account Information ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-10">
            <h3 className="text-base font-bold text-slate-800 mb-4">Account Information</h3>
            <div className="divide-y divide-slate-100">
              {[
                { label: 'Email',          value: <span className="font-semibold text-slate-800">{displayEmail || '—'}</span> },
                { label: 'Phone',          value: <span className="font-semibold text-slate-800">{profile?.phone || <span className="text-slate-400 font-normal">Not set</span>}</span> },
                { label: 'Account Type',   value: <span className="capitalize font-semibold text-slate-800">{profile?.role || 'user'}</span> },
                { label: 'Account Status', value: <span className={`capitalize font-semibold ${profile?.account_status === 'active' ? 'text-emerald-600' : 'text-red-600'}`}>{profile?.account_status || 'active'}</span> },
                { label: 'Member Since',   value: <span className="font-semibold text-slate-800">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span> },
                { label: 'Last Sign-in',   value: <span className="font-semibold text-slate-800">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span> },
                { label: 'Reports Received', value: <span className={`font-semibold ${(profile?.reports_received_count ?? 0) > 0 ? 'text-red-600' : 'text-slate-800'}`}>{profile?.reports_received_count ?? 0}</span> },
                { label: 'Trust Level',    value: <span className="font-semibold" style={{ color: levelDetails.color }}>{trustLevel}</span> },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-3.5">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm">{value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

import { supabase } from './supabase';

const supabaseAdmin = supabase.getServiceClient();

// ============================================
// Trust Score Service - Production Ready
// Handles all trust score updates and queries
// ============================================

export interface TrustScoreUpdate {
  success: boolean;
  message: string;
  previousScore: number;
  newScore: number;
  previousLevel: string;
  newLevel: string;
}

export interface TrustLog {
  id: string;
  userId: string;
  actionType: string;
  pointsChange: number;
  previousScore: number;
  newScore: number;
  previousLevel: string;
  newLevel: string;
  reason: string | null;
  metadata: any;
  adminId: string | null;
  createdAt: string;
}

export interface UserTrustSummary {
  id: string;
  name: string;
  email: string;
  trustScore: number;
  trustLevel: string;
  abuseReportsCount: number;
  profileCompleted: boolean;
  emailVerified: boolean;
  lastTrustUpdate: string | null;
  totalTrustEvents: number;
  positiveEvents: number;
  negativeEvents: number;
  totalPointsEarned: number;
  totalPointsLost: number;
}

// Trust Action Types
export const TrustActionTypes = {
  EMAIL_VERIFIED: 'email_verified',
  PROFILE_COMPLETED: 'profile_completed',
  CLAIM_APPROVED: 'claim_approved',
  CLAIM_REJECTED: 'claim_rejected',
  ITEM_RETURNED: 'item_returned',
  SPAM_ITEM_DETECTED: 'spam_item_detected',
  CHAT_COMPLETED_NO_COMPLAINT: 'chat_completed_no_complaint',
  ABUSE_REPORT_CONFIRMED: 'abuse_report_confirmed',
  ADMIN_FLAG: 'admin_flag',
  ACTIVE_30_DAYS_NO_ABUSE: 'active_30_days_no_abuse',
  ADMIN_OVERRIDE: 'admin_override',
} as const;

// Trust Action Points
export const TrustActionPoints = {
  [TrustActionTypes.EMAIL_VERIFIED]: 5,
  [TrustActionTypes.PROFILE_COMPLETED]: 5,
  [TrustActionTypes.CLAIM_APPROVED]: 10,
  [TrustActionTypes.CLAIM_REJECTED]: -8,
  [TrustActionTypes.ITEM_RETURNED]: 15,
  [TrustActionTypes.SPAM_ITEM_DETECTED]: -25,
  [TrustActionTypes.CHAT_COMPLETED_NO_COMPLAINT]: 5,
  [TrustActionTypes.ABUSE_REPORT_CONFIRMED]: -15,
  [TrustActionTypes.ADMIN_FLAG]: -20,
  [TrustActionTypes.ACTIVE_30_DAYS_NO_ABUSE]: 5,
  [TrustActionTypes.ADMIN_OVERRIDE]: 0, // Points set manually by admin
} as const;

/**
 * Calculate trust level based on score
 */
export const calculateTrustLevel = (score: number): string => {
  if (score >= 0 && score <= 30) return 'Risky User';
  if (score >= 31 && score <= 50) return 'Fair Trust';
  if (score >= 51 && score <= 70) return 'Good Trust';
  if (score >= 71 && score <= 85) return 'High Trust';
  if (score >= 86 && score <= 100) return 'Verified Trusted Member';
  return 'Unknown';
};

/**
 * Get trust level color and icon
 */
export const getTrustLevelDetails = (level: string) => {
  const details: Record<string, { color: string; bgColor: string; icon: string; badge: string }> = {
    'Risky User': {
      color: '#dc2626',
      bgColor: '#fee2e2',
      icon: '⚠️',
      badge: 'danger',
    },
    'Fair Trust': {
      color: '#ea580c',
      bgColor: '#ffedd5',
      icon: '⚡',
      badge: 'warning',
    },
    'Good Trust': {
      color: '#0891b2',
      bgColor: '#cffafe',
      icon: '✓',
      badge: 'info',
    },
    'High Trust': {
      color: '#059669',
      bgColor: '#d1fae5',
      icon: '★',
      badge: 'success',
    },
    'Verified Trusted Member': {
      color: '#7c3aed',
      bgColor: '#ede9fe',
      icon: '👑',
      badge: 'premium',
    },
  };
  return details[level] || { color: '#6b7280', bgColor: '#f3f4f6', icon: '?', badge: 'default' };
};

/**
 * Update trust score using database function
 * This is the main method to update trust scores
 */
export const updateTrustScore = async (
  userId: string,
  actionType: string,
  pointsChange: number,
  reason?: string,
  metadata: any = {},
  adminId?: string
): Promise<TrustScoreUpdate> => {
  try {
    console.log(`🔄 Updating trust score for user ${userId}`, {
      actionType,
      pointsChange,
      reason,
    });

    const { data, error } = await supabaseAdmin.rpc('update_trust_score', {
      p_user_id: userId,
      p_action_type: actionType,
      p_points_change: pointsChange,
      p_reason: reason || null,
      p_metadata: metadata,
      p_admin_id: adminId || null,
    });

    if (error) {
      console.error('❌ Error updating trust score:', error);
      throw error;
    }

    const result = data[0];
    console.log(`✅ Trust score updated successfully:`, {
      previousScore: result.previous_score,
      newScore: result.new_score,
      previousLevel: result.previous_level,
      newLevel: result.new_level,
    });

    // Sync the new score to user_profiles table (frontend reads from this table)
    try {
      await supabaseAdmin
        .from('user_profiles')
        .update({ trust_score: result.new_score })
        .eq('user_id', userId);
      console.log(`🔄 Synced trust score ${result.new_score} to user_profiles`);
    } catch (syncErr: any) {
      console.warn('⚠️ Failed to sync trust score to user_profiles:', syncErr.message);
    }

    return {
      success: result.success,
      message: result.message,
      previousScore: result.previous_score,
      newScore: result.new_score,
      previousLevel: result.previous_level,
      newLevel: result.new_level,
    };
  } catch (error: any) {
    console.error('❌ Failed to update trust score:', error);
    throw new Error(`Trust score update failed: ${error.message}`);
  }
};

/**
 * Update trust score using predefined action type
 */
export const updateTrustScoreByAction = async (
  userId: string,
  actionType: keyof typeof TrustActionTypes,
  metadata: any = {},
  adminId?: string
): Promise<TrustScoreUpdate> => {
  const action = TrustActionTypes[actionType];
  const points = TrustActionPoints[action as keyof typeof TrustActionPoints];
  
  if (points === undefined) {
    throw new Error(`Unknown action type: ${actionType}`);
  }

  return updateTrustScore(userId, action, points, undefined, metadata, adminId);
};

/**
 * Get user's trust score and level
 */
export const getUserTrustScore = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id, full_name, email, avatar_url, trust_score')
    .eq('user_id', userId)
    .single();

  if (error) throw error;

  // Calculate trust level from score since user_profiles may not have it
  const trust_level = calculateTrustLevel(data.trust_score ?? 50);

  return {
    id: data.user_id,
    name: data.full_name,
    email: data.email,
    avatar_url: data.avatar_url,
    trust_score: data.trust_score ?? 50,
    trust_level,
    last_trust_update: null,
    abuse_reports_count: 0,
    profile_completed: !!data.full_name,
    email_verified: !!data.email,
  };
};

/**
 * Get trust logs for a user
 */
export const getUserTrustLogs = async (
  userId: string,
  limit: number = 50
): Promise<TrustLog[]> => {
  const { data, error } = await supabaseAdmin
    .from('trust_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  return data.map((log: any) => ({
    id: log.id,
    userId: log.user_id,
    actionType: log.action_type,
    pointsChange: log.points_change,
    previousScore: log.previous_score,
    newScore: log.new_score,
    previousLevel: log.previous_level,
    newLevel: log.new_level,
    reason: log.reason,
    metadata: log.metadata,
    adminId: log.admin_id,
    createdAt: log.created_at,
  }));
};

/**
 * Get user trust summary — falls back to user_profiles + trust_logs if view doesn't exist
 */
export const getUserTrustSummary = async (userId: string): Promise<UserTrustSummary> => {
  // Try the view first, fall back to manual aggregation
  try {
    const { data, error } = await supabaseAdmin
      .from('user_trust_summary')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        trustScore: data.trust_score,
        trustLevel: data.trust_level,
        abuseReportsCount: data.abuse_reports_count ?? 0,
        profileCompleted: data.profile_completed ?? false,
        emailVerified: data.email_verified ?? false,
        lastTrustUpdate: data.last_trust_update,
        totalTrustEvents: data.total_trust_events ?? 0,
        positiveEvents: data.positive_events ?? 0,
        negativeEvents: data.negative_events ?? 0,
        totalPointsEarned: data.total_points_earned ?? 0,
        totalPointsLost: data.total_points_lost ?? 0,
      };
    }
  } catch { /* view may not exist, fall through */ }

  // Fallback: build summary from user_profiles + trust_logs
  const profile = await getUserTrustScore(userId);
  const logs = await getUserTrustLogs(userId, 1000);

  const positiveEvents = logs.filter(l => l.pointsChange > 0);
  const negativeEvents = logs.filter(l => l.pointsChange < 0);

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    trustScore: profile.trust_score,
    trustLevel: calculateTrustLevel(profile.trust_score),
    abuseReportsCount: 0,
    profileCompleted: profile.profile_completed,
    emailVerified: profile.email_verified,
    lastTrustUpdate: logs[0]?.createdAt || null,
    totalTrustEvents: logs.length,
    positiveEvents: positiveEvents.length,
    negativeEvents: negativeEvents.length,
    totalPointsEarned: positiveEvents.reduce((s, l) => s + l.pointsChange, 0),
    totalPointsLost: Math.abs(negativeEvents.reduce((s, l) => s + l.pointsChange, 0)),
  };
};

/**
 * Admin: Override trust score
 */
export const adminOverrideTrustScore = async (
  adminId: string,
  userId: string,
  newScore: number,
  reason: string
): Promise<TrustScoreUpdate> => {
  // Verify admin permissions
  const { data: admin } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('user_id', adminId)
    .single();

  if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  // Get current score
  const { data: user } = await supabaseAdmin
    .from('user_profiles')
    .select('trust_score')
    .eq('user_id', userId)
    .single();

  if (!user) {
    throw new Error('User not found');
  }

  const pointsChange = newScore - user.trust_score;

  return updateTrustScore(
    userId,
    TrustActionTypes.ADMIN_OVERRIDE,
    pointsChange,
    reason,
    { overridden_by: adminId, old_score: user.trust_score, new_score: newScore },
    adminId
  );
};

/**
 * Check if user profile is complete (for trust scoring)
 */
export const checkAndUpdateProfileCompletion = async (userId: string): Promise<boolean> => {
  const { data: user } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name, avatar_url, bio')
    .eq('user_id', userId)
    .single();

  if (!user) return false;

  const isComplete = !!(user.full_name && user.avatar_url);
  return isComplete;
};

/**
 * Handle email verification trust update
 */
export const handleEmailVerification = async (userId: string): Promise<void> => {
  // Trust score update is handled by database triggers
  console.log(`[TRUST] Email verification recorded for user ${userId}`);
};

/**
 * Get users by trust level
 */
export const getUsersByTrustLevel = async (trustLevel: string, limit: number = 100) => {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id, full_name, email, trust_score')
    .order('trust_score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  // Filter by calculated trust level
  return (data || []).filter(u => calculateTrustLevel(u.trust_score ?? 50) === trustLevel)
    .map(u => ({
      id: u.user_id,
      name: u.full_name,
      email: u.email,
      trust_score: u.trust_score ?? 50,
      trust_level: calculateTrustLevel(u.trust_score ?? 50),
    }));
};

/**
 * Get top trusted users
 */
export const getTopTrustedUsers = async (limit: number = 10) => {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id, full_name, email, trust_score')
    .gte('trust_score', 70)
    .order('trust_score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(u => ({
    id: u.user_id,
    name: u.full_name,
    email: u.email,
    trust_score: u.trust_score ?? 50,
    trust_level: calculateTrustLevel(u.trust_score ?? 50),
  }));
};

/**
 * Get risky users (for admin monitoring)
 */
export const getRiskyUsers = async (limit: number = 50) => {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id, full_name, email, trust_score')
    .lte('trust_score', 30)
    .order('trust_score', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(u => ({
    id: u.user_id,
    name: u.full_name,
    email: u.email,
    trust_score: u.trust_score ?? 50,
    trust_level: calculateTrustLevel(u.trust_score ?? 50),
    abuse_reports_count: 0,
  }));
};

/**
 * Get trust statistics (for admin dashboard)
 */
export const getTrustStatistics = async () => {
  const { data: allUsers, error } = await supabaseAdmin
    .from('user_profiles')
    .select('trust_score')
    .not('trust_score', 'is', null);

  if (error) throw error;

  const stats = {
    totalUsers: (allUsers || []).length,
    byLevel: {
      'Risky User': 0,
      'Fair Trust': 0,
      'Good Trust': 0,
      'High Trust': 0,
      'Verified Trusted Member': 0,
    } as Record<string, number>,
    averageScore: 0,
  };

  let totalScore = 0;
  (allUsers || []).forEach((user: any) => {
    const score = user.trust_score ?? 50;
    totalScore += score;
    const level = calculateTrustLevel(score);
    if (stats.byLevel[level] !== undefined) {
      stats.byLevel[level]++;
    }
  });

  if (stats.totalUsers > 0) {
    stats.averageScore = Math.round(totalScore / stats.totalUsers);
  }

  return stats;
};

/**
 * Rate limiter for abuse-based updates
 * Prevents spam of abuse reports
 */
const abuseUpdateRateLimiter = new Map<string, number>();

export const canUpdateAbuseReport = (userId: string): boolean => {
  const key = `abuse_${userId}`;
  const lastUpdate = abuseUpdateRateLimiter.get(key);
  const now = Date.now();
  const cooldownMs = 60 * 60 * 1000; // 1 hour

  if (lastUpdate && now - lastUpdate < cooldownMs) {
    return false;
  }

  abuseUpdateRateLimiter.set(key, now);
  return true;
};

/**
 * Handle item return success
 */
export const handleItemReturn = async (itemId: string): Promise<void> => {
  // Get item and update status
  const { data: item } = await supabaseAdmin
    .from('items')
    .select('id, user_id, status')
    .eq('id', itemId)
    .single();

  if (!item || item.status === 'returned') return;

  await supabaseAdmin
    .from('items')
    .update({ status: 'returned' })
    .eq('id', itemId);

  // Trust score will be updated by trigger automatically
};

/**
 * Handle chat completion
 */
export const handleChatCompletion = async (
  sessionId: string,
  completedWithoutComplaint: boolean
): Promise<void> => {
  await supabaseAdmin
    .from('chat_sessions')
    .update({ 
      completed_without_complaint: completedWithoutComplaint,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  // Trust score will be updated by trigger automatically for both users
};

export default {
  updateTrustScore,
  updateTrustScoreByAction,
  getUserTrustScore,
  getUserTrustLogs,
  getUserTrustSummary,
  adminOverrideTrustScore,
  checkAndUpdateProfileCompletion,
  handleEmailVerification,
  getUsersByTrustLevel,
  getTopTrustedUsers,
  getRiskyUsers,
  getTrustStatistics,
  calculateTrustLevel,
  getTrustLevelDetails,
  TrustActionTypes,
  TrustActionPoints,
  canUpdateAbuseReport,
  handleItemReturn,
  handleChatCompletion,
};

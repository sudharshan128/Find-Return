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
  lastTrustUpdate: string;
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
    .from('users')
    .select('id, name, email, trust_score, trust_level, last_trust_update, abuse_reports_count, profile_completed, email_verified')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
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
 * Get user trust summary (from view)
 */
export const getUserTrustSummary = async (userId: string): Promise<UserTrustSummary> => {
  const { data, error } = await supabaseAdmin
    .from('user_trust_summary')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    trustScore: data.trust_score,
    trustLevel: data.trust_level,
    abuseReportsCount: data.abuse_reports_count,
    profileCompleted: data.profile_completed,
    emailVerified: data.email_verified,
    lastTrustUpdate: data.last_trust_update,
    totalTrustEvents: data.total_trust_events,
    positiveEvents: data.positive_events,
    negativeEvents: data.negative_events,
    totalPointsEarned: data.total_points_earned,
    totalPointsLost: data.total_points_lost,
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
    .from('users')
    .select('role')
    .eq('id', adminId)
    .single();

  if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  // Get current score
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('trust_score')
    .eq('id', userId)
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
    .from('users')
    .select('name, image_gallery_url, profile_completed')
    .eq('id', userId)
    .single();

  if (!user) return false;

  const isComplete = !!(user.name && user.image_gallery_url);

  // Update profile_completed flag if status changed
  if (isComplete && !user.profile_completed) {
    await supabaseAdmin
      .from('users')
      .update({ profile_completed: true })
      .eq('id', userId);
    
    // Trust score will be updated by trigger automatically
    return true;
  }

  return isComplete;
};

/**
 * Handle email verification trust update
 */
export const handleEmailVerification = async (userId: string): Promise<void> => {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('email_verified')
    .eq('id', userId)
    .single();

  if (!user?.email_verified) {
    await supabaseAdmin
      .from('users')
      .update({ email_verified: true })
      .eq('id', userId);
    
    // Trust score will be updated by trigger automatically
  }
};

/**
 * Get users by trust level
 */
export const getUsersByTrustLevel = async (trustLevel: string, limit: number = 100) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, trust_score, trust_level, last_trust_update')
    .eq('trust_level', trustLevel)
    .order('trust_score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

/**
 * Get top trusted users
 */
export const getTopTrustedUsers = async (limit: number = 10) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, trust_score, trust_level, last_trust_update')
    .gte('trust_score', 70)
    .order('trust_score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

/**
 * Get risky users (for admin monitoring)
 */
export const getRiskyUsers = async (limit: number = 50) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, trust_score, trust_level, abuse_reports_count, last_trust_update')
    .lte('trust_score', 30)
    .order('trust_score', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data;
};

/**
 * Get trust statistics (for admin dashboard)
 */
export const getTrustStatistics = async () => {
  // Get count by trust level
  const { data: levelStats, error: levelError } = await supabaseAdmin
    .from('users')
    .select('trust_level')
    .not('trust_level', 'is', null);

  if (levelError) throw levelError;

  const stats = {
    totalUsers: levelStats.length,
    byLevel: {
      'Risky User': 0,
      'Fair Trust': 0,
      'Good Trust': 0,
      'High Trust': 0,
      'Verified Trusted Member': 0,
    },
    averageScore: 0,
  };

  let totalScore = 0;
  levelStats.forEach((user: any) => {
    stats.byLevel[user.trust_level as keyof typeof stats.byLevel]++;
  });

  // Get average score
  const { data: scoreData } = await supabaseAdmin
    .from('users')
    .select('trust_score')
    .not('trust_score', 'is', null);

  if (scoreData && scoreData.length > 0) {
    totalScore = scoreData.reduce((sum: number, user: any) => sum + (user.trust_score || 0), 0);
    stats.averageScore = Math.round(totalScore / scoreData.length);
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

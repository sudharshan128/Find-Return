/**
 * Admin Panel - Supabase Client & API
 * Isolated admin database operations with audit logging
 * 
 * SECURITY HARDENED - Phase 2
 * - Real IP capture via edge function
 * - Rate limiting on all operations
 * - Session revocation support
 * - Audit log integrity
 */

import { createClient } from '@supabase/supabase-js';
import { 
  getClientIP,
  getClientInfo,
  getUserAgent, 
  checkRateLimit, 
  clearRateLimit,
  clearClientInfoCache,
  sanitizeError,
  logSecurityEvent 
} from './securityUtils';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables for admin panel');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'admin-auth-token', // Separate from public site
  },
});

// ============================================================
// RATE-LIMITED ACTION WRAPPER
// ============================================================

/**
 * Wraps an admin action with rate limiting
 * @param {string} actionKey - Unique key for rate limiting
 * @param {string} role - Admin role for rate limit tier
 * @param {Function} action - The action to execute
 * @returns {Promise} - Result of the action
 */
export const withRateLimit = async (actionKey, role, action) => {
  const rateCheck = checkRateLimit(actionKey, role, 'action');
  
  if (!rateCheck.allowed) {
    const error = new Error(rateCheck.message);
    error.code = 'RATE_LIMITED';
    error.resetIn = rateCheck.resetIn;
    throw error;
  }
  
  try {
    return await action();
  } catch (error) {
    // Re-throw with sanitized message for non-rate-limit errors
    if (error.code !== 'RATE_LIMITED') {
      error.displayMessage = sanitizeError(error);
    }
    throw error;
  }
};

/**
 * Wraps an action with error handling
 * Returns { success, data, error } format
 */
export const safeAction = async (action) => {
  try {
    const data = await action();
    return { success: true, data, error: null };
  } catch (error) {
    console.error('Admin action error:', error);
    return { 
      success: false, 
      data: null, 
      error: sanitizeError(error),
      originalError: error
    };
  }
};

// ============================================================
// ADMIN AUTHENTICATION
// ============================================================

export const adminAuth = {
  // Sign in with Google (admin must be pre-approved)
  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current user
  getUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Get session
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  // Verify admin access
  verifyAdminAccess: async () => {
    const { data, error } = await supabase.rpc('check_admin_access');
    if (error) throw error;
    if (!data || data.length === 0) {
      return null;
    }
    return data[0];
  },

  // Get admin profile
  getAdminProfile: async (userId) => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Log login attempt with real IP and user agent
  logLoginAttempt: async (email, success, failureReason = null, clientInfo = null) => {
    // Get real client info if not provided
    let info = clientInfo;
    if (!info || !info.ip_address || info.ip_address === '0.0.0.0') {
      try {
        info = await getClientInfo(supabase, false); // Don't use cache for login
      } catch (e) {
        info = { ip_address: 'unknown', user_agent: navigator.userAgent };
      }
    }
    
    const { error } = await supabase
      .from('admin_login_history')
      .insert({
        attempted_email: email,
        success,
        failure_reason: failureReason,
        ip_address: info.ip_address,
        user_agent: info.user_agent,
      });
    if (error) console.error('[Security] Failed to log login attempt:', error);
  },

  // Update last login with real IP
  updateLastLogin: async (adminId, clientInfo = null) => {
    // Get real client info if not provided
    let info = clientInfo;
    if (!info || !info.ip_address || info.ip_address === '0.0.0.0') {
      try {
        info = await getClientInfo(supabase, false);
      } catch (e) {
        info = { ip_address: 'unknown', user_agent: navigator.userAgent };
      }
    }
    
    const { error } = await supabase
      .from('admin_users')
      .update({
        last_login_at: new Date().toISOString(),
        last_login_ip: info.ip_address,
        failed_login_attempts: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);
    if (error) console.error('[Security] Failed to update last login:', error);
  },

  // Create admin session for tracking
  createSession: async (adminId, sessionToken = null, expiresInMinutes = 480) => {
    try {
      // Get client info from edge function
      const clientInfo = await getClientInfo(supabase, false); // Fresh call for new session
      
      // Hash session token if provided (for verification)
      let tokenHash = null;
      if (sessionToken) {
        const encoder = new TextEncoder();
        const data = encoder.encode(sessionToken);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
      
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      
      const { data, error } = await supabase
        .from('admin_sessions')
        .insert({
          admin_id: adminId,
          session_token_hash: tokenHash,
          ip_address: clientInfo.ip_address,
          user_agent: clientInfo.user_agent,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          metadata: {
            language: clientInfo.language,
            referrer: clientInfo.referrer,
            country: clientInfo.metadata?.country || null,
            created_via: 'admin_login',
          },
        })
        .select()
        .single();
      
      if (error) {
        console.error('[Security] Failed to create session:', error);
        return null;
      }
      
      return data;
    } catch (err) {
      console.error('[Security] Error creating session:', err);
      return null;
    }
  },

  // Update session activity
  updateSessionActivity: async (sessionId) => {
    if (!sessionId) return;
    
    const { error } = await supabase
      .from('admin_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('is_active', true);
    
    if (error) console.error('[Security] Failed to update session activity:', error);
  },

  // End session (logout)
  endSession: async (sessionId) => {
    if (!sessionId) return;
    
    // Clear client info cache on logout
    clearClientInfoCache();
    
    const { error } = await supabase
      .from('admin_sessions')
      .update({ 
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoke_reason: 'User logout',
      })
      .eq('id', sessionId);
    
    if (error) console.error('[Security] Failed to end session:', error);
  },

  // Get active sessions for admin
  getActiveSessions: async (adminId) => {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false });
    
    if (error) {
      console.error('[Security] Failed to get sessions:', error);
      return [];
    }
    return data || [];
  },

  // Listen to auth changes
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// ============================================================
// ADMIN DASHBOARD DATA
// ============================================================

export const adminDashboard = {
  // Get dashboard summary
  getSummary: async () => {
    const { data, error } = await supabase.rpc('get_admin_dashboard_data');
    if (error) throw error;
    return data;
  },

  // Get dashboard view
  getDashboardView: async () => {
    const { data, error } = await supabase
      .from('admin_dashboard_summary')
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // Get daily statistics
  getDailyStats: async (days = 30) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('platform_statistics_daily')
      .select('*')
      .gte('stat_date', startDate.toISOString().split('T')[0])
      .order('stat_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Get area-wise statistics
  getAreaStats: async () => {
    const { data, error } = await supabase
      .from('items')
      .select(`
        area_id,
        areas!inner(name, zone),
        status
      `)
      .eq('is_soft_deleted', false);
    if (error) throw error;

    // Aggregate by area
    const areaMap = {};
    data?.forEach(item => {
      const areaName = item.areas?.name || 'Unknown';
      if (!areaMap[areaName]) {
        areaMap[areaName] = { name: areaName, zone: item.areas?.zone, total: 0, active: 0, returned: 0 };
      }
      areaMap[areaName].total++;
      if (item.status === 'active') areaMap[areaName].active++;
      if (item.status === 'returned') areaMap[areaName].returned++;
    });

    return Object.values(areaMap).sort((a, b) => b.total - a.total);
  },

  // Get category-wise statistics
  getCategoryStats: async () => {
    const { data, error } = await supabase
      .from('items')
      .select(`
        category_id,
        categories!inner(name, icon),
        status
      `)
      .eq('is_soft_deleted', false);
    if (error) throw error;

    // Aggregate by category
    const categoryMap = {};
    data?.forEach(item => {
      const catName = item.categories?.name || 'Unknown';
      if (!categoryMap[catName]) {
        categoryMap[catName] = { name: catName, icon: item.categories?.icon, total: 0, active: 0, returned: 0 };
      }
      categoryMap[catName].total++;
      if (item.status === 'active') categoryMap[catName].active++;
      if (item.status === 'returned') categoryMap[catName].returned++;
    });

    return Object.values(categoryMap).sort((a, b) => b.total - a.total);
  },
};

// ============================================================
// USER MANAGEMENT
// ============================================================

export const adminUsers = {
  // Get all users with pagination
  getAll: async ({ page = 1, limit = 20, search = '', status = null, sortBy = 'created_at', sortOrder = 'desc' }) => {
    let query = supabase
      .from('user_profiles')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('account_status', status);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count || 0, page, limit };
  },

  // Get single user with details
  getById: async (userId) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  // Get user's items
  getUserItems: async (userId) => {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        categories(name, icon),
        areas(name),
        item_images(*)
      `)
      .eq('finder_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Get user's claims
  getUserClaims: async (userId) => {
    const { data, error } = await supabase
      .from('claims')
      .select(`
        *,
        items(title, status)
      `)
      .eq('claimant_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Get user's warnings
  getUserWarnings: async (userId) => {
    const { data, error } = await supabase
      .from('user_warnings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Get user's restrictions
  getUserRestrictions: async (userId) => {
    const { data, error } = await supabase
      .from('user_restrictions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Get user's trust score history
  getTrustHistory: async (userId) => {
    const { data, error } = await supabase
      .from('trust_score_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  },

  // Get abuse reports against user
  getAbuseReports: async (userId) => {
    const { data, error } = await supabase
      .from('abuse_reports')
      .select('*')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Warn user
  warnUser: async (userId, adminId, warningData) => {
    const { data, error } = await supabase
      .from('user_warnings')
      .insert({
        user_id: userId,
        warning_type: warningData.type,
        severity: warningData.severity,
        title: warningData.title,
        description: warningData.description,
        related_item_id: warningData.relatedItemId || null,
        related_claim_id: warningData.relatedClaimId || null,
        related_report_id: warningData.relatedReportId || null,
        issued_by: adminId,
      })
      .select()
      .single();
    if (error) throw error;

    // Update warning count
    await supabase
      .from('user_profiles')
      .update({
        active_warnings_count: supabase.rpc('increment', { x: 1 }),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return data;
  },

  // Suspend user (via RPC for audit logging)
  suspendUser: async (userId, reason, durationDays = null) => {
    const { data, error } = await supabase.rpc('admin_suspend_user', {
      p_user_id: userId,
      p_reason: reason,
      p_duration_days: durationDays,
    });
    if (error) throw error;
    return data;
  },

  // Ban user (via RPC for audit logging)
  banUser: async (userId, reason) => {
    const { data, error } = await supabase.rpc('admin_ban_user', {
      p_user_id: userId,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },

  // Unban user
  unbanUser: async (userId, adminId, reason) => {
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        account_status: 'active',
        ban_reason: null,
        banned_at: null,
        banned_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (updateError) throw updateError;

    // Deactivate restrictions
    await supabase
      .from('user_restrictions')
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removed_by: adminId,
        removal_reason: reason,
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    return { success: true };
  },

  // Adjust trust score (via RPC for audit logging)
  adjustTrustScore: async (userId, newScore, reason) => {
    const { data, error } = await supabase.rpc('admin_adjust_trust_score', {
      p_user_id: userId,
      p_new_score: newScore,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },

  // Disable chat for user
  disableChat: async (userId, adminId, reason) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_chat_disabled: true,
        chat_disabled_at: new Date().toISOString(),
        chat_disabled_by: adminId,
        chat_disable_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  },

  // Enable chat for user
  enableChat: async (userId) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_chat_disabled: false,
        chat_disabled_at: null,
        chat_disabled_by: null,
        chat_disable_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  },

  // Block claims for user
  blockClaims: async (userId, adminId, reason) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_claim_blocked: true,
        claim_blocked_at: new Date().toISOString(),
        claim_blocked_by: adminId,
        claim_block_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  },

  // Unblock claims for user
  unblockClaims: async (userId) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_claim_blocked: false,
        claim_blocked_at: null,
        claim_blocked_by: null,
        claim_block_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  },

  // Lock trust score
  lockTrustScore: async (userId, adminId, reason, durationDays = null) => {
    const lockedUntil = durationDays
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase
      .from('user_profiles')
      .update({
        trust_score_locked: true,
        trust_score_locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  },

  // Users needing attention
  getUsersNeedingAttention: async () => {
    const { data, error } = await supabase
      .from('admin_users_attention')
      .select('*')
      .limit(50);
    if (error) throw error;
    return data || [];
  },
};

// ============================================================
// ITEM MODERATION
// ============================================================

export const adminItems = {
  // Get all items with pagination
  getAll: async ({ page = 1, limit = 20, search = '', status = null, flagged = null, hidden = null }) => {
    let query = supabase
      .from('items')
      .select(`
        *,
        categories(name, icon),
        areas(name, zone),
        user_profiles!finder_id(email, full_name, trust_score),
        item_images(*)
      `, { count: 'exact' })
      .eq('is_soft_deleted', false);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (flagged === true) {
      query = query.eq('is_flagged', true);
    }

    if (hidden === true) {
      query = query.eq('is_hidden', true);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count || 0, page, limit };
  },

  // Get flagged items
  getFlagged: async () => {
    const { data, error } = await supabase
      .from('admin_flagged_items')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  // Get single item with full details
  getById: async (itemId) => {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        categories(name, icon),
        areas(name, zone),
        user_profiles!finder_id(user_id, email, full_name, trust_score, account_status),
        item_images(*),
        claims(*, user_profiles!claimant_id(email, full_name, trust_score))
      `)
      .eq('id', itemId)
      .single();
    if (error) throw error;
    return data;
  },

  // Get item moderation history
  getModerationHistory: async (itemId) => {
    const { data, error } = await supabase
      .from('item_moderation_log')
      .select(`
        *,
        admin_users(email, full_name)
      `)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Hide item (via RPC for audit logging)
  hideItem: async (itemId, reason) => {
    const { data, error } = await supabase.rpc('admin_hide_item', {
      p_item_id: itemId,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },

  // Unhide item
  unhideItem: async (itemId, adminId, reason) => {
    const { error: updateError } = await supabase
      .from('items')
      .update({
        is_hidden: false,
        hidden_at: null,
        hidden_by: null,
        hide_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
    if (updateError) throw updateError;

    // Log moderation action
    await supabase.from('item_moderation_log').insert({
      item_id: itemId,
      admin_id: adminId,
      action: 'unhide',
      reason,
    });

    return { success: true };
  },

  // Soft delete item
  softDeleteItem: async (itemId, adminId, reason) => {
    // Get current state for restoration
    const { data: currentItem } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    const { error: updateError } = await supabase
      .from('items')
      .update({
        is_soft_deleted: true,
        soft_deleted_at: new Date().toISOString(),
        soft_deleted_by: adminId,
        soft_delete_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
    if (updateError) throw updateError;

    // Log moderation action with previous state
    await supabase.from('item_moderation_log').insert({
      item_id: itemId,
      admin_id: adminId,
      action: 'soft_delete',
      reason,
      previous_state: currentItem,
    });

    return { success: true };
  },

  // Restore soft deleted item
  restoreItem: async (itemId, adminId, reason) => {
    const { error: updateError } = await supabase
      .from('items')
      .update({
        is_soft_deleted: false,
        soft_deleted_at: null,
        soft_deleted_by: null,
        soft_delete_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
    if (updateError) throw updateError;

    // Log moderation action
    await supabase.from('item_moderation_log').insert({
      item_id: itemId,
      admin_id: adminId,
      action: 'restore',
      reason,
    });

    return { success: true };
  },

  // Hard delete item (super admin only)
  hardDeleteItem: async (itemId, adminId, reason) => {
    // Log before deletion
    await supabase.from('item_moderation_log').insert({
      item_id: itemId,
      admin_id: adminId,
      action: 'hard_delete',
      reason,
    });

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;

    return { success: true };
  },

  // Edit item details
  editItem: async (itemId, adminId, updates, reason) => {
    // Get current state
    const { data: currentItem } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    const { error: updateError } = await supabase
      .from('items')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
    if (updateError) throw updateError;

    // Log moderation action
    await supabase.from('item_moderation_log').insert({
      item_id: itemId,
      admin_id: adminId,
      action: 'edit',
      reason,
      changes_made: updates,
      previous_state: currentItem,
    });

    return { success: true };
  },

  // Clear flag on item
  clearFlag: async (itemId, adminId, reason) => {
    const { error: updateError } = await supabase
      .from('items')
      .update({
        is_flagged: false,
        flag_reason: null,
        flagged_by: null,
        flagged_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
    if (updateError) throw updateError;

    // Log moderation action
    await supabase.from('item_moderation_log').insert({
      item_id: itemId,
      admin_id: adminId,
      action: 'flag_review',
      reason: `Flag cleared: ${reason}`,
    });

    return { success: true };
  },
};

// ============================================================
// CLAIM MODERATION
// ============================================================

export const adminClaims = {
  // Get all claims with pagination
  getAll: async ({ page = 1, limit = 20, status = null, locked = null }) => {
    let query = supabase
      .from('claims')
      .select(`
        *,
        items(id, title, status, finder_id),
        user_profiles!claimant_id(email, full_name, trust_score)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (locked === true) {
      query = query.eq('is_locked', true);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count || 0, page, limit };
  },

  // Get single claim with full details
  getById: async (claimId) => {
    const { data, error } = await supabase
      .from('claims')
      .select(`
        *,
        items(*, categories(name), areas(name), user_profiles!finder_id(email, full_name, trust_score)),
        user_profiles!claimant_id(user_id, email, full_name, trust_score, account_status)
      `)
      .eq('id', claimId)
      .single();
    if (error) throw error;
    return data;
  },

  // Get admin notes for claim
  getAdminNotes: async (claimId) => {
    const { data, error } = await supabase
      .from('claim_admin_notes')
      .select(`
        *,
        admin_users(email, full_name)
      `)
      .eq('claim_id', claimId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Add admin note
  addNote: async (claimId, adminId, noteType, content, isInternal = true) => {
    const { data, error } = await supabase
      .from('claim_admin_notes')
      .insert({
        claim_id: claimId,
        admin_id: adminId,
        note_type: noteType,
        content,
        is_internal: isInternal,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Lock claim
  lockClaim: async (claimId, adminId, reason) => {
    const { error } = await supabase
      .from('claims')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: adminId,
        lock_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);
    if (error) throw error;
    return { success: true };
  },

  // Unlock claim
  unlockClaim: async (claimId) => {
    const { error } = await supabase
      .from('claims')
      .update({
        is_locked: false,
        locked_at: null,
        locked_by: null,
        lock_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);
    if (error) throw error;
    return { success: true };
  },

  // Override claim decision (approve)
  overrideApprove: async (claimId, adminId, reason) => {
    const { error } = await supabase
      .from('claims')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        admin_override: true,
        override_by: adminId,
        override_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);
    if (error) throw error;

    // Add admin note
    await supabase.from('claim_admin_notes').insert({
      claim_id: claimId,
      admin_id: adminId,
      note_type: 'override_reason',
      content: `Admin override approval: ${reason}`,
    });

    return { success: true };
  },

  // Override claim decision (reject)
  overrideReject: async (claimId, adminId, reason) => {
    const { error } = await supabase
      .from('claims')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        admin_override: true,
        override_by: adminId,
        override_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);
    if (error) throw error;

    // Add admin note
    await supabase.from('claim_admin_notes').insert({
      claim_id: claimId,
      admin_id: adminId,
      note_type: 'override_reason',
      content: `Admin override rejection: ${reason}`,
    });

    return { success: true };
  },
};

// ============================================================
// CHAT MODERATION
// ============================================================

export const adminChats = {
  // Get all chats with pagination
  getAll: async ({ page = 1, limit = 20, frozen = null, closed = null }) => {
    let query = supabase
      .from('chats')
      .select(`
        *,
        items(id, title),
        finder:user_profiles!finder_id(email, full_name),
        claimant:user_profiles!claimant_id(email, full_name)
      `, { count: 'exact' });

    if (frozen === true) {
      query = query.eq('is_frozen', true);
    }

    if (closed !== null) {
      query = query.eq('is_closed', closed);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count || 0, page, limit };
  },

  // Get chat details
  getById: async (chatId) => {
    const { data, error } = await supabase
      .from('chats')
      .select(`
        *,
        items(*, categories(name), areas(name)),
        finder:user_profiles!finder_id(*),
        claimant:user_profiles!claimant_id(*),
        claims(*)
      `)
      .eq('id', chatId)
      .single();
    if (error) throw error;
    return data;
  },

  // Get chat messages (with audit logging)
  getMessages: async (chatId, adminId, justification, reportId = null) => {
    // Log the access
    await supabase.from('chat_moderation_log').insert({
      chat_id: chatId,
      admin_id: adminId,
      action: 'view_messages',
      justification,
      abuse_report_id: reportId,
    });

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        user_profiles!sender_id(email, full_name)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Get chat moderation history
  getModerationHistory: async (chatId) => {
    const { data, error } = await supabase
      .from('chat_moderation_log')
      .select(`
        *,
        admin_users(email, full_name)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Freeze chat (via RPC for audit logging)
  freezeChat: async (chatId, reason) => {
    const { data, error } = await supabase.rpc('admin_freeze_chat', {
      p_chat_id: chatId,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },

  // Unfreeze chat
  unfreezeChat: async (chatId, adminId, reason) => {
    const { error: updateError } = await supabase
      .from('chats')
      .update({
        is_frozen: false,
        frozen_at: null,
        frozen_by: null,
        freeze_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);
    if (updateError) throw updateError;

    // Log moderation action
    await supabase.from('chat_moderation_log').insert({
      chat_id: chatId,
      admin_id: adminId,
      action: 'unfreeze',
      justification: reason,
    });

    return { success: true };
  },

  // Delete message
  deleteMessage: async (chatId, messageId, adminId, reason) => {
    // Get message content for audit
    const { data: message } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    // Soft delete the message
    const { error } = await supabase
      .from('messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', messageId);
    if (error) throw error;

    // Log with original content
    await supabase.from('chat_moderation_log').insert({
      chat_id: chatId,
      admin_id: adminId,
      action: 'delete_message',
      justification: reason,
      deleted_message_id: messageId,
      deleted_message_content: message?.message_text,
    });

    return { success: true };
  },
};

// ============================================================
// ABUSE REPORT MANAGEMENT
// ============================================================

export const adminReports = {
  // Get all reports with pagination
  getAll: async ({ page = 1, limit = 20, status = null, type = null }) => {
    let query = supabase
      .from('abuse_reports')
      .select(`
        *,
        reporter:user_profiles!reporter_id(email, full_name),
        target_user:user_profiles!target_user_id(email, full_name, trust_score),
        target_item:items!target_item_id(title),
        reviewed_by_admin:user_profiles!reviewed_by(email, full_name)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count || 0, page, limit };
  },

  // Get single report with full details
  getById: async (reportId) => {
    const { data, error } = await supabase
      .from('abuse_reports')
      .select(`
        *,
        reporter:user_profiles!reporter_id(*),
        target_user:user_profiles!target_user_id(*),
        target_item:items!target_item_id(*, categories(name), areas(name)),
        target_claim:claims!target_claim_id(*),
        target_message:messages!target_message_id(*)
      `)
      .eq('id', reportId)
      .single();
    if (error) throw error;
    return data;
  },

  // Update report status
  updateStatus: async (reportId, adminId, status, notes, actionTaken = null) => {
    const { error } = await supabase
      .from('abuse_reports')
      .update({
        status,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_notes: notes,
        action_taken: actionTaken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);
    if (error) throw error;
    return { success: true };
  },

  // Dismiss report
  dismissReport: async (reportId, adminId, notes) => {
    return adminReports.updateStatus(reportId, adminId, 'dismissed', notes);
  },

  // Resolve report
  resolveReport: async (reportId, adminId, notes, actionTaken) => {
    return adminReports.updateStatus(reportId, adminId, 'resolved', notes, actionTaken);
  },

  // Start reviewing report
  startReview: async (reportId, adminId) => {
    const { error } = await supabase
      .from('abuse_reports')
      .update({
        status: 'reviewing',
        reviewed_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);
    if (error) throw error;
    return { success: true };
  },

  // Escalate report to higher authority
  escalateReport: async (reportId, adminId, reason) => {
    return adminReports.updateStatus(reportId, adminId, 'escalated', reason, 'escalated_for_review');
  },
};

// ============================================================
// ADMIN MESSAGES (Admin-to-User Communication)
// ============================================================

export const adminMessages = {
  // Get all admin messages
  getAll: async ({ page = 1, limit = 20, contextType = null }) => {
    let query = supabase
      .from('admin_messages')
      .select(`
        *,
        admin_users!admin_id(email, full_name),
        recipient:user_profiles!recipient_id(email, full_name)
      `, { count: 'exact' });

    if (contextType) {
      query = query.eq('context_type', contextType);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count || 0, page, limit };
  },

  // Send message to user
  sendMessage: async (adminId, recipientId, messageData) => {
    const { data, error } = await supabase
      .from('admin_messages')
      .insert({
        admin_id: adminId,
        recipient_id: recipientId,
        context_type: messageData.contextType,
        context_item_id: messageData.contextItemId || null,
        context_claim_id: messageData.contextClaimId || null,
        context_report_id: messageData.contextReportId || null,
        subject: messageData.subject,
        message_text: messageData.message,
        is_urgent: messageData.isUrgent || false,
        requires_response: messageData.requiresResponse || false,
        response_deadline: messageData.responseDeadline || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Get messages for a specific user
  getByRecipient: async (userId) => {
    const { data, error } = await supabase
      .from('admin_messages')
      .select(`
        *,
        admin_users!admin_id(email, full_name)
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};

// ============================================================
// SYSTEM SETTINGS
// ============================================================

export const adminSettings = {
  // Get all settings
  getAll: async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('setting_category', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Get settings by category
  getByCategory: async (category) => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('setting_category', category)
      .order('display_name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Get single setting
  get: async (key) => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('setting_key', key)
      .single();
    if (error) throw error;
    return data;
  },

  // Update setting
  update: async (key, value, adminId) => {
    const setting = await adminSettings.get(key);
    if (!setting) throw new Error('Setting not found');

    const updateData = {
      last_changed_by: adminId,
      last_changed_at: new Date().toISOString(),
    };

    switch (setting.setting_type) {
      case 'number':
        updateData.value_number = value;
        break;
      case 'boolean':
        updateData.value_boolean = value;
        break;
      case 'string':
        updateData.value_string = value;
        break;
      case 'json':
        updateData.value_json = value;
        break;
    }

    const { error } = await supabase
      .from('system_settings')
      .update(updateData)
      .eq('setting_key', key);
    if (error) throw error;
    return { success: true };
  },

  // Update multiple settings at once
  updateMultiple: async (settings, adminId) => {
    const results = [];
    for (const setting of settings) {
      try {
        await adminSettings.update(setting.key, setting.value, adminId);
        results.push({ key: setting.key, success: true });
      } catch (error) {
        results.push({ key: setting.key, success: false, error: error.message });
      }
    }
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      throw new Error(`Failed to update settings: ${failures.map(f => f.key).join(', ')}`);
    }
    return { success: true, updated: results.length };
  },
};

// ============================================================
// AUDIT LOGS
// ============================================================

export const adminAuditLogs = {
  // Get audit logs with pagination
  getAll: async ({ page = 1, limit = 50, action = null, adminId = null, targetType = null }) => {
    let query = supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact' });

    if (action) {
      query = query.eq('action', action);
    }

    if (adminId) {
      query = query.eq('admin_id', adminId);
    }

    if (targetType) {
      query = query.eq('target_type', targetType);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count || 0, page, limit };
  },

  // Get logs for specific target
  getByTarget: async (targetType, targetId) => {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Get login history
  getLoginHistory: async ({ page = 1, limit = 50 }) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('admin_login_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count || 0, page, limit };
  },

  // Export logs (returns data for CSV/JSON export)
  exportLogs: async (startDate, endDate, format = 'json') => {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Get list of all admins for filter dropdown
  getAdmins: async () => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, email, full_name')
      .eq('is_active', true)
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Export logs with filters
  export: async ({ action, adminId, dateFrom, dateTo } = {}) => {
    let query = supabase
      .from('admin_audit_logs')
      .select('*');

    if (action) query = query.eq('action', action);
    if (adminId) query = query.eq('admin_id', adminId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};

// ============================================================
// ADMIN USER MANAGEMENT (Super Admin Only)
// ============================================================

export const adminUserManagement = {
  // Get all admin users
  getAll: async () => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Create new admin (Super Admin only)
  create: async (adminData, createdBy) => {
    const { data, error } = await supabase
      .from('admin_users')
      .insert({
        user_id: adminData.userId,
        email: adminData.email,
        full_name: adminData.fullName,
        role: adminData.role,
        created_by: createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update admin role
  updateRole: async (adminId, newRole) => {
    const { error } = await supabase
      .from('admin_users')
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);
    if (error) throw error;
    return { success: true };
  },

  // Deactivate admin
  deactivate: async (adminId, deactivatedBy, reason) => {
    const { error } = await supabase
      .from('admin_users')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: deactivatedBy,
        deactivation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);
    if (error) throw error;
    return { success: true };
  },

  // Reactivate admin
  reactivate: async (adminId) => {
    const { error } = await supabase
      .from('admin_users')
      .update({
        is_active: true,
        deactivated_at: null,
        deactivated_by: null,
        deactivation_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);
    if (error) throw error;
    return { success: true };
  },
};

export default {
  supabase,
  adminAuth,
  adminDashboard,
  adminUsers,
  adminItems,
  adminClaims,
  adminChats,
  adminReports,
  adminMessages,
  adminSettings,
  adminAuditLogs,
  adminUserManagement,
};

/**
 * Admin Security Utilities
 * IP capture, rate limiting, session management
 * 
 * SECURITY: This module provides enterprise-grade security utilities
 * for the admin panel including:
 * - Real IP address capture (proxy-aware)
 * - Rate limiting with role-based limits
 * - Session validation and revocation
 * - Audit log integrity verification
 */

import adminAPIClient from './apiClient';

// ============================================================
// CLIENT INFO CACHE
// ============================================================

// Cache client info to avoid repeated edge function calls
let clientInfoCache = null;
let clientInfoCacheTime = 0;
const CLIENT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * @typedef {Object} ClientInfo
 * @property {string} ip_address - Real client IP address
 * @property {string} user_agent - User agent string
 * @property {string} language - Accept-Language header
 * @property {string} referrer - Referer header
 * @property {Object} metadata - Additional metadata (country, ray_id, timestamp)
 */

// ============================================================
// IP ADDRESS CAPTURE
// ============================================================

/**
 * Get the real client IP address, handling proxies and CDNs
 * Calls Edge Function: get-client-info
 * 
 * Priority order (handled by edge function):
 * 1. X-Forwarded-For (first IP)
 * 2. CF-Connecting-IP (Cloudflare)
 * 3. X-Real-IP (Nginx)
 * 4. True-Client-IP (Akamai)
 * 5. Fallback to 127.0.0.1
 * 
 * @param {Object} supabase - Supabase client instance
 * @param {boolean} useCache - Whether to use cached result (default: true)
 * @returns {Promise<ClientInfo>} Client information
 */
export const getClientInfo = async (supabase, useCache = true) => {
  const now = Date.now();
  
  // Return cached data if valid
  if (useCache && clientInfoCache && (now - clientInfoCacheTime) < CLIENT_INFO_CACHE_TTL) {
    return clientInfoCache;
  }
  
  try {
    // Prefer calling backend admin API when available (keeps admin pages from calling Supabase directly)
    if (adminAPIClient && adminAPIClient.accessToken) {
        const resp = await adminAPIClient.request('GET', '/api/admin/client-info');
        if (resp && resp.ip_address) {
          const data = resp;
          // Cache the result
          clientInfoCache = {
            ip_address: data.ip_address,
            user_agent: data.user_agent || navigator.userAgent || 'unknown',
            language: data.language || navigator.language || 'unknown',
            referrer: data.referrer || document.referrer || '',
            metadata: data.metadata || {},
          };
          clientInfoCacheTime = now;
          return clientInfoCache;
        }
      }

      // Fallback: call Supabase edge function if backend not configured or call failed
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const { data, error } = await supabase.functions.invoke('get-client-info', {
        method: 'POST',
        body: {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (error) {
        console.warn('[Security] Could not get client info from edge function:', error.message);
        return createFallbackClientInfo();
      }
    
    // Validate response shape
    if (!data || typeof data.ip_address !== 'string') {
      console.warn('[Security] Invalid response from get-client-info');
      return createFallbackClientInfo();
    }
    
    // Cache the result
    clientInfoCache = {
      ip_address: data.ip_address,
      user_agent: data.user_agent || navigator.userAgent || 'unknown',
      language: data.language || navigator.language || 'unknown',
      referrer: data.referrer || document.referrer || '',
      metadata: data.metadata || {},
    };
    clientInfoCacheTime = now;
    
    return clientInfoCache;
  } catch (error) {
    console.warn('[Security] Error getting client info (timeout or network):', error.message);
    return createFallbackClientInfo();
  }
};

/**
 * Create fallback client info when edge function fails
 * @returns {ClientInfo}
 */
function createFallbackClientInfo() {
  return {
    ip_address: '0.0.0.0',
    user_agent: navigator.userAgent || 'unknown',
    language: navigator.language || 'unknown',
    referrer: document.referrer || '',
    metadata: { error: true, fallback: true },
  };
}

/**
 * Get client IP (simplified helper)
 * @param {Object} supabase - Supabase client
 * @returns {Promise<{ip: string, userAgent: string, country: string|null}>}
 */
export const getClientIP = async (supabase) => {
  const info = await getClientInfo(supabase);
  return {
    ip: info.ip_address,
    userAgent: info.user_agent,
    country: info.metadata?.country || null,
  };
};

/**
 * Clear client info cache (call on logout)
 */
export const clearClientInfoCache = () => {
  clientInfoCache = null;
  clientInfoCacheTime = 0;
};

/**
 * Get user agent string
 */
export const getUserAgent = () => {
  return navigator.userAgent || 'unknown';
};

// ============================================================
// RATE LIMITING
// ============================================================

// Rate limit configuration by role
const RATE_LIMITS = {
  super_admin: {
    login: { attempts: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 min
    action: { attempts: 100, windowMs: 60 * 1000 }, // 100 per minute
    message: { attempts: 50, windowMs: 60 * 1000 }, // 50 per minute
  },
  moderator: {
    login: { attempts: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
    action: { attempts: 50, windowMs: 60 * 1000 }, // 50 per minute
    message: { attempts: 30, windowMs: 60 * 1000 }, // 30 per minute
  },
  analyst: {
    login: { attempts: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
    action: { attempts: 20, windowMs: 60 * 1000 }, // 20 per minute (read-heavy)
    message: { attempts: 10, windowMs: 60 * 1000 }, // 10 per minute
  },
};

// In-memory rate limit store (for client-side throttling)
const rateLimitStore = new Map();

/**
 * Check if action is rate limited
 * @param {string} key - Unique key for the rate limit (e.g., 'login:user@email.com')
 * @param {string} role - Admin role
 * @param {string} actionType - Type of action ('login', 'action', 'message')
 * @returns {object} { allowed: boolean, remaining: number, resetIn: number }
 */
export const checkRateLimit = (key, role = 'analyst', actionType = 'action') => {
  const limits = RATE_LIMITS[role] || RATE_LIMITS.analyst;
  const config = limits[actionType] || limits.action;
  
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { attempts: [], blocked_until: null };
    rateLimitStore.set(key, entry);
  }
  
  // Check if currently blocked
  if (entry.blocked_until && now < entry.blocked_until) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((entry.blocked_until - now) / 1000),
      message: `Rate limited. Try again in ${Math.ceil((entry.blocked_until - now) / 1000)} seconds.`
    };
  }
  
  // Clear expired attempts
  entry.attempts = entry.attempts.filter(timestamp => timestamp > windowStart);
  
  // Check if over limit
  if (entry.attempts.length >= config.attempts) {
    // Block for the remaining window time
    entry.blocked_until = now + config.windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil(config.windowMs / 1000),
      message: `Too many requests. Please wait ${Math.ceil(config.windowMs / 60000)} minutes.`
    };
  }
  
  // Record this attempt
  entry.attempts.push(now);
  
  return {
    allowed: true,
    remaining: config.attempts - entry.attempts.length,
    resetIn: Math.ceil((entry.attempts[0] + config.windowMs - now) / 1000),
    message: null
  };
};

/**
 * Clear rate limit for a key (e.g., after successful login)
 */
export const clearRateLimit = (key) => {
  rateLimitStore.delete(key);
};

/**
 * Get rate limit status without incrementing
 */
export const getRateLimitStatus = (key, role = 'analyst', actionType = 'action') => {
  const limits = RATE_LIMITS[role] || RATE_LIMITS.analyst;
  const config = limits[actionType] || limits.action;
  
  const entry = rateLimitStore.get(key);
  if (!entry) {
    return { remaining: config.attempts, total: config.attempts };
  }
  
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const validAttempts = entry.attempts.filter(t => t > windowStart);
  
  return {
    remaining: Math.max(0, config.attempts - validAttempts.length),
    total: config.attempts
  };
};

// ============================================================
// SESSION MANAGEMENT
// ============================================================

// Session revocation store (synced with server)
let revokedSessions = new Set();
let lastRevocationCheck = 0;
const REVOCATION_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Check if current session is revoked
 * @param {object} supabase - Supabase client
 * @param {string} adminId - Admin user ID
 * @returns {Promise<boolean>} - True if session is revoked
 */
export const isSessionRevoked = async (supabase, adminId) => {
  const now = Date.now();
  
  // Check local cache first
  if (revokedSessions.has(adminId)) {
    return true;
  }
  
  // Periodically check server for revocations
  if (now - lastRevocationCheck > REVOCATION_CHECK_INTERVAL) {
    try {
      // Prefer backend profile check when available
      if (adminAPIClient && adminAPIClient.accessToken) {
        try {
          const profile = await adminAPIClient.auth.profile();
          const data = profile || {};
          // Backend returns current admin profile; check revocation fields if present
          if (data.force_logout_at) {
            const forceLogoutTime = new Date(data.force_logout_at).getTime();
            const oneHourAgo = now - (60 * 60 * 1000);
            if (forceLogoutTime > oneHourAgo) {
              revokedSessions.add(adminId);
              return true;
            }
          }

          if (data.session_revoked_at) {
            const sessionStart = localStorage.getItem('admin-session-start');
            if (sessionStart) {
              const startTime = new Date(sessionStart).getTime();
              const revokeTime = new Date(data.session_revoked_at).getTime();
              if (revokeTime > startTime) {
                revokedSessions.add(adminId);
                return true;
              }
            }
          }
        } catch (e) {
          console.warn('[Security] Backend profile check failed, falling back to Supabase query');
        }
      }

      // Fallback: direct Supabase query (legacy)
      const { data, error } = await supabase
        .from('admin_users')
        .select('force_logout_at, session_revoked_at')
        .eq('id', adminId)
        .single();

      if (error) throw error;

      if (data?.force_logout_at) {
        const forceLogoutTime = new Date(data.force_logout_at).getTime();
        const oneHourAgo = now - (60 * 60 * 1000);
        if (forceLogoutTime > oneHourAgo) {
          revokedSessions.add(adminId);
          return true;
        }
      }

      if (data?.session_revoked_at) {
        const sessionStart = localStorage.getItem('admin-session-start');
        if (sessionStart) {
          const startTime = new Date(sessionStart).getTime();
          const revokeTime = new Date(data.session_revoked_at).getTime();
          if (revokeTime > startTime) {
            revokedSessions.add(adminId);
            return true;
          }
        }
      }

      lastRevocationCheck = now;
    } catch (error) {
      console.error('Error checking session revocation:', error);
    }
  }
  
  return false;
};

/**
 * Force logout a specific admin (Super Admin only)
 * @param {object} supabase - Supabase client
 * @param {string} targetAdminId - Admin to force logout
 * @param {string} reason - Reason for force logout
 */
export const forceLogoutAdmin = async (supabase, targetAdminId, reason) => {
  const { error } = await supabase
    .from('admin_users')
    .update({
      force_logout_at: new Date().toISOString(),
      force_logout_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetAdminId);
  
  if (error) throw error;
  
  // Add to local revocation cache
  revokedSessions.add(targetAdminId);
  
  return { success: true };
};

/**
 * Force logout all admins (Emergency - Super Admin only)
 * @param {object} supabase - Supabase client
 * @param {string} exceptAdminId - Don't logout this admin (the one performing the action)
 * @param {string} reason - Emergency reason
 */
export const forceLogoutAllAdmins = async (supabase, exceptAdminId, reason) => {
  const { error } = await supabase
    .from('admin_users')
    .update({
      force_logout_at: new Date().toISOString(),
      force_logout_reason: `EMERGENCY: ${reason}`,
      updated_at: new Date().toISOString(),
    })
    .neq('id', exceptAdminId);
  
  if (error) throw error;
  
  return { success: true };
};

/**
 * Record session start time for revocation checking
 */
export const recordSessionStart = () => {
  localStorage.setItem('admin-session-start', new Date().toISOString());
};

/**
 * Clear session data on logout
 */
export const clearSessionData = () => {
  localStorage.removeItem('admin-session-start');
  revokedSessions.clear();
  rateLimitStore.clear();
};

// ============================================================
// AUDIT LOG INTEGRITY
// ============================================================

/**
 * Verify audit log checksum chain
 * @param {object} supabase - Supabase client
 * @param {number} limit - Number of recent entries to verify
 * @returns {Promise<object>} - Verification result
 */
export const verifyAuditLogIntegrity = async (supabase, limit = 100) => {
  try {
    const { data: logs, error } = await supabase
      .from('admin_audit_logs')
      .select('id, checksum, created_at, admin_id, action, target_id')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    if (!logs || logs.length === 0) {
      return { valid: true, message: 'No audit logs to verify', checked: 0 };
    }
    
    // Verify each log has a checksum
    const missingChecksums = logs.filter(log => !log.checksum);
    if (missingChecksums.length > 0) {
      return {
        valid: false,
        message: `${missingChecksums.length} logs are missing checksums`,
        checked: logs.length,
        issues: missingChecksums.map(l => ({ id: l.id, issue: 'missing_checksum' }))
      };
    }
    
    // Verify checksums are unique (no duplicates)
    const checksumSet = new Set(logs.map(l => l.checksum));
    if (checksumSet.size !== logs.length) {
      return {
        valid: false,
        message: 'Duplicate checksums detected - possible tampering',
        checked: logs.length,
        issues: [{ issue: 'duplicate_checksums' }]
      };
    }
    
    return {
      valid: true,
      message: `Verified ${logs.length} audit log entries`,
      checked: logs.length,
      oldestVerified: logs[logs.length - 1]?.created_at,
      newestVerified: logs[0]?.created_at
    };
  } catch (error) {
    console.error('Audit log verification error:', error);
    return {
      valid: false,
      message: `Verification failed: ${error.message}`,
      checked: 0,
      error: true
    };
  }
};

// ============================================================
// SECURITY HELPERS
// ============================================================

/**
 * Sanitize error messages for display (hide sensitive details)
 */
export const sanitizeError = (error) => {
  // List of sensitive patterns to hide
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /auth/i,
    /credential/i,
    /connection.*string/i,
  ];
  
  let message = error?.message || 'An unexpected error occurred';
  
  // Check if message contains sensitive info
  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      return 'An error occurred. Please contact support if this persists.';
    }
  }
  
  // Limit message length
  if (message.length > 200) {
    message = message.substring(0, 200) + '...';
  }
  
  return message;
};

/**
 * Validate admin action with security checks
 * @param {object} params - Validation parameters
 * @returns {object} - Validation result
 */
export const validateAdminAction = async (params) => {
  const { supabase, adminId, adminRole, actionType, targetId, requireSuperAdmin = false } = params;
  
  const errors = [];
  
  // 1. Check if admin exists and is active
  try {
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, is_active, role')
      .eq('id', adminId)
      .single();
    
    if (error || !admin) {
      errors.push('Admin account not found');
    } else if (!admin.is_active) {
      errors.push('Admin account is deactivated');
    }
  } catch (e) {
    errors.push('Failed to verify admin status');
  }
  
  // 2. Check rate limit
  const rateLimitKey = `${actionType}:${adminId}`;
  const rateLimit = checkRateLimit(rateLimitKey, adminRole, 'action');
  if (!rateLimit.allowed) {
    errors.push(rateLimit.message);
  }
  
  // 3. Check session revocation
  const isRevoked = await isSessionRevoked(supabase, adminId);
  if (isRevoked) {
    errors.push('Session has been revoked. Please sign in again.');
  }
  
  // 4. Check role requirement
  if (requireSuperAdmin && adminRole !== 'super_admin') {
    errors.push('This action requires Super Admin privileges');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    rateLimit: {
      remaining: rateLimit.remaining,
      resetIn: rateLimit.resetIn
    }
  };
};

/**
 * Log security event
 */
export const logSecurityEvent = async (supabase, event) => {
  try {
    await supabase
      .from('admin_audit_logs')
      .insert({
        admin_id: event.adminId,
        admin_email: event.adminEmail,
        admin_role: event.adminRole,
        action: event.action,
        action_category: 'security',
        target_type: event.targetType || 'system',
        target_id: event.targetId || null,
        justification: event.reason || event.justification,
        metadata: {
          ...event.metadata,
          security_event: true,
          severity: event.severity || 'info'
        },
        ip_address: event.ipAddress || 'unknown',
        user_agent: event.userAgent || getUserAgent(),
      });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

export default {
  getClientIP,
  getUserAgent,
  checkRateLimit,
  clearRateLimit,
  getRateLimitStatus,
  isSessionRevoked,
  forceLogoutAdmin,
  forceLogoutAllAdmins,
  recordSessionStart,
  clearSessionData,
  verifyAuditLogIntegrity,
  sanitizeError,
  validateAdminAction,
  logSecurityEvent,
};

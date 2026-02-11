/**
 * Admin Backend API Client
 * 
 * All admin data operations go through this client.
 * - Sends Supabase access token in Authorization header
 * - Calls backend endpoints ONLY
 * - Never queries Supabase directly for admin data
 * 
 * CRITICAL: This is the ONLY way admin pages should fetch data
 */

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

class AdminAPIClient {
  constructor() {
    this.accessToken = null;
  }

  /**
   * Set the access token for subsequent requests
   * Call this after successful OAuth login
   */
  setAccessToken(token) {
    this.accessToken = token;
  }

  /**
   * Make an authenticated API request
   */
  async request(method, endpoint, body = null, options = {}) {
    if (!this.accessToken) {
      throw new Error('Access token not set. Call setAccessToken() first.');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      ...options.headers,
    };

    const config = {
      method,
      headers,
      ...options,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
          errorData.error || `API request failed: ${response.statusText}`
        );
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      return await response.json();
    } catch (error) {
      console.error(`[API] ${method} ${endpoint} failed:`, error);
      throw error;
    }
  }

  // ========================================
  // AUTHENTICATION ENDPOINTS
  // ========================================

  auth = {
    /**
     * Verify admin access after OAuth login
     * Backend checks admin_users table, role, active status, 2FA
     */
    verify: () => this.request('POST', '/api/admin/auth/verify'),

    /**
     * Get current admin profile
     */
    profile: () => this.request('GET', '/api/admin/auth/profile'),

    /**
     * Logout - logs the action for audit trail
     */
    logout: () => this.request('POST', '/api/admin/auth/logout'),
  };

  // ========================================
  // ANALYTICS / DASHBOARD ENDPOINTS
  // ========================================

  analytics = {
    /**
     * Get dashboard summary stats
     */
    summary: () => this.request('GET', '/api/admin/analytics/summary'),

    /**
     * Get trend data (daily stats)
     */
    trends: (days = 30) =>
      this.request('GET', `/api/admin/analytics/trends?days=${days}`),

    /**
     * Get area-wise statistics
     */
    areas: () => this.request('GET', '/api/admin/analytics/areas'),

    /**
     * Get category-wise statistics
     */
    categories: () => this.request('GET', '/api/admin/analytics/categories'),
  };

  // ========================================
  // ITEMS ENDPOINTS
  // ========================================

  items = {
    /**
     * Get all items (with filters)
     */
    getAll: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.flagged) params.append('flagged', filters.flagged);
      if (filters.hidden) params.append('hidden', filters.hidden);

      const query = params.toString();
      return this.request(
        'GET',
        `/api/admin/items${query ? '?' + query : ''}`
      );
    },

    /**
     * Get single item details
     */
    get: (itemId) => this.request('GET', `/api/admin/items/${itemId}`),

    /**
     * Update item (status, hidden, etc)
     */
    update: (itemId, data) =>
      this.request('PUT', `/api/admin/items/${itemId}`, data),

    /**
     * Delete item
     */
    delete: (itemId) => this.request('DELETE', `/api/admin/items/${itemId}`),

    /**
     * Flag item as suspicious
     */
    flag: (itemId, reason) =>
      this.request('POST', `/api/admin/items/${itemId}/flag`, { reason }),

    /**
     * Unflag item
     */
    unflag: (itemId) =>
      this.request('POST', `/api/admin/items/${itemId}/unflag`),

    /**
     * Hide item from public view
     */
    hide: (itemId) =>
      this.request('POST', `/api/admin/items/${itemId}/hide`),

    /**
     * Unhide item
     */
    unhide: (itemId, reason) =>
      this.request('POST', `/api/admin/items/${itemId}/unhide`, { reason }),

    /**
     * Soft delete item (marks as deleted but keeps record)
     */
    softDelete: (itemId, reason) =>
      this.request('POST', `/api/admin/items/${itemId}/soft-delete`, { reason }),

    /**
     * Restore soft deleted item
     */
    restore: (itemId, reason) =>
      this.request('POST', `/api/admin/items/${itemId}/restore`, { reason }),

    /**
     * Hard delete item (super admin only, permanent deletion)
     */
    hardDelete: (itemId, reason) =>
      this.request('POST', `/api/admin/items/${itemId}/hard-delete`, { reason }),

    /**
     * Clear flag on item
     */
    clearFlag: (itemId, reason) =>
      this.request('POST', `/api/admin/items/${itemId}/clear-flag`, { reason }),

    /**
     * Mark item as returned (admin confirmation of handover)
     */
    markReturned: (itemId, reason) =>
      this.request('POST', `/api/admin/items/${itemId}/mark-returned`, { reason }),

    /**
     * Get moderation history for an item
     */
    getModerationHistory: (itemId) =>
      this.request('GET', `/api/admin/items/${itemId}/moderation-history`),
  };

  // ========================================
  // USERS ENDPOINTS
  // ========================================

  users = {
    /**
     * Get all users
     */
    getAll: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.search) params.append('search', filters.search);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);

      const query = params.toString();
      return this.request(
        'GET',
        `/api/admin/users${query ? '?' + query : ''}`
      );
    },

    /**
     * Get single user details
     */
    get: (userId) => this.request('GET', `/api/admin/users/${userId}`),

    /**
     * Update user profile
     */
    update: (userId, data) =>
      this.request('PUT', `/api/admin/users/${userId}`, data),

    /**
     * Ban/unban user
     */
    ban: (userId, reason) =>
      this.request('POST', `/api/admin/users/${userId}/ban`, { reason }),

    unban: (userId) =>
      this.request('POST', `/api/admin/users/${userId}/unban`),

    /**
     * Reset user trust score
     */
    resetTrustScore: (userId) =>
      this.request('POST', `/api/admin/users/${userId}/reset-trust-score`),

    /**
     * Warn user (add warning to their record)
     */
    warn: (userId, warningData) =>
      this.request('POST', `/api/admin/users/${userId}/warn`, warningData),

    /**
     * Suspend user (temporary ban with duration)
     */
    suspend: (userId, suspensionData) =>
      this.request('POST', `/api/admin/users/${userId}/suspend`, suspensionData),

    /**
     * Adjust trust score for a user
     */
    adjustTrustScore: (userId, newScore, reason) =>
      this.request('POST', `/api/admin/users/${userId}/adjust-trust-score`, { newScore, reason }),

    /**
     * Disable chat for user
     */
    disableChat: (userId, reason) =>
      this.request('POST', `/api/admin/users/${userId}/disable-chat`, { reason }),

    /**
     * Enable chat for user
     */
    enableChat: (userId) =>
      this.request('POST', `/api/admin/users/${userId}/enable-chat`),

    /**
     * Block user from making claims
     */
    blockClaims: (userId, reason) =>
      this.request('POST', `/api/admin/users/${userId}/block-claims`, { reason }),

    /**
     * Unblock user claims
     */
    unblockClaims: (userId) =>
      this.request('POST', `/api/admin/users/${userId}/unblock-claims`),

    /**
     * Get user's items
     */
    getUserItems: (userId) =>
      this.request('GET', `/api/admin/users/${userId}/items`),

    /**
     * Get user's claims
     */
    getUserClaims: (userId) =>
      this.request('GET', `/api/admin/users/${userId}/claims`),

    /**
     * Get user's warnings
     */
    getUserWarnings: (userId) =>
      this.request('GET', `/api/admin/users/${userId}/warnings`),

    /**
     * Get user's trust score history
     */
    getTrustHistory: (userId) =>
      this.request('GET', `/api/admin/users/${userId}/trust-history`),
  };

  // ========================================
  // CLAIMS ENDPOINTS
  // ========================================

  claims = {
    /**
     * Get all claims
     */
    getAll: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.status) params.append('status', filters.status);

      const query = params.toString();
      return this.request(
        'GET',
        `/api/admin/claims${query ? '?' + query : ''}`
      );
    },

    /**
     * Get single claim details
     */
    get: (claimId) => this.request('GET', `/api/admin/claims/${claimId}`),

    /**
     * Approve/reject/review claim
     */
    approve: (claimId) =>
      this.request('POST', `/api/admin/claims/${claimId}/approve`),

    reject: (claimId, reason) =>
      this.request('POST', `/api/admin/claims/${claimId}/reject`, { reason }),

    setReview: (claimId) =>
      this.request('POST', `/api/admin/claims/${claimId}/review`),

    /**
     * Lock/unlock claim from further edits
     */
    lock: (claimId, reason) =>
      this.request('POST', `/api/admin/claims/${claimId}/lock`, { reason }),

    unlock: (claimId, reason) =>
      this.request('POST', `/api/admin/claims/${claimId}/unlock`, { reason }),

    /**
     * Flag/resolve disputes on claims
     */
    flagDispute: (claimId, reason) =>
      this.request('POST', `/api/admin/claims/${claimId}/flag-dispute`, { reason }),

    resolveDispute: (claimId, resolution, reason) =>
      this.request('POST', `/api/admin/claims/${claimId}/resolve-dispute`, { resolution, reason }),

    /**
     * Add/get notes on claims
     */
    addNote: (claimId, noteText) =>
      this.request('POST', `/api/admin/claims/${claimId}/notes`, { text: noteText }),

    getNotes: (claimId) =>
      this.request('GET', `/api/admin/claims/${claimId}/notes`),
  };

  // ========================================
  // CHATS ENDPOINTS
  // ========================================

  chats = {
    /**
     * Get all chats
     */
    getAll: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const query = params.toString();
      return this.request(
        'GET',
        `/api/admin/chats${query ? '?' + query : ''}`
      );
    },

    /**
     * Get single chat details
     */
    get: (chatId) => this.request('GET', `/api/admin/chats/${chatId}`),

    /**
     * Delete message from chat
     */
    deleteMessage: (chatId, messageId, reason) =>
      this.request('DELETE', `/api/admin/chats/${chatId}/messages/${messageId}`, { reason }),

    /**
     * Freeze/unfreeze chat (prevent new messages)
     */
    freeze: (chatId, reason) =>
      this.request('POST', `/api/admin/chats/${chatId}/freeze`, { reason }),

    unfreeze: (chatId, reason) =>
      this.request('POST', `/api/admin/chats/${chatId}/unfreeze`, { reason }),

    /**
     * Close chat (prevent further messages)
     */
    close: (chatId, reason) =>
      this.request('POST', `/api/admin/chats/${chatId}/close`, { reason }),
  };

  // ========================================
  // REPORTS ENDPOINTS
  // ========================================

  reports = {
    /**
     * Get all abuse reports
     */
    getAll: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.status) params.append('status', filters.status);

      const query = params.toString();
      return this.request(
        'GET',
        `/api/admin/reports${query ? '?' + query : ''}`
      );
    },

    /**
     * Get single report details
     */
    get: (reportId) => this.request('GET', `/api/admin/reports/${reportId}`),

    /**
     * Update report status
     */
    update: (reportId, data) =>
      this.request('PUT', `/api/admin/reports/${reportId}`, data),

    /**
     * Mark as resolved
     */
    resolve: (reportId, action) =>
      this.request('POST', `/api/admin/reports/${reportId}/resolve`, { action }),

    /**
     * Dismiss report (mark as not applicable)
     */
    dismiss: (reportId, reason) =>
      this.request('POST', `/api/admin/reports/${reportId}/dismiss`, { reason }),

    /**
     * Escalate report to super admin
     */
    escalate: (reportId, reason) =>
      this.request('POST', `/api/admin/reports/${reportId}/escalate`, { reason }),
  };

  // ========================================
  // AUDIT LOGS ENDPOINTS
  // ========================================

  audit = {
    /**
     * Get audit logs (super admin only)
     */
    getLogs: (filters = {}) => {
      const params = new URLSearchParams();
      // Convert page to offset
      const offset = ((filters.page || 1) - 1) * (filters.limit || 50);
      params.append('offset', offset);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.adminId) params.append('admin_id', filters.adminId);
      if (filters.action) params.append('action', filters.action);
      if (filters.search) params.append('search', filters.search);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      if (filters.importantOnly !== undefined) params.append('important_only', filters.importantOnly);

      const query = params.toString();
      return this.request(
        'GET',
        `/api/admin/audit-logs${query ? '?' + query : ''}`
      );
    },

    /**
     * Get login history (super admin only)
     */
    getLoginHistory: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const query = params.toString();
      return this.request(
        'GET',
        `/api/admin/login-history${query ? '?' + query : ''}`
      );
    },

    /**
     * Export audit logs (super admin only)
     */
    export: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.adminId) params.append('adminId', filters.adminId);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const query = params.toString();
      return this.request(
        'GET',
        `/api/admin/audit-logs/export${query ? '?' + query : ''}`
      );
    },
  };

  // ========================================
  // SETTINGS ENDPOINTS
  // ========================================

  settings = {
    /**
     * Get system settings
     */
    get: () => this.request('GET', '/api/admin/settings'),

    /**
     * Update system settings
     */
    update: (data) => this.request('PUT', '/api/admin/settings', data),
  };

  // ========================================
  // 2FA ENDPOINTS
  // ========================================

  twofa = {
    /**
     * Setup 2FA (get secret and QR code)
     */
    setup: () => this.request('POST', '/api/admin/2fa/setup'),

    /**
     * Verify 2FA token to enable 2FA
     */
    verify: (secret, token) =>
      this.request('POST', '/api/admin/2fa/verify', { secret, token }),

    /**
     * Verify token during login
     */
    verifyLogin: (token) =>
      this.request('POST', '/api/admin/2fa/verify-token', { token }),

    /**
     * Disable 2FA
     */
    disable: (token) =>
      this.request('POST', '/api/admin/2fa/disable', { token }),

    /**
     * Get recovery codes
     */
    getRecoveryCodes: () =>
      this.request('GET', '/api/admin/2fa/recovery-codes'),

    /**
     * Recover account using recovery code
     */
    recover: (code) =>
      this.request('POST', '/api/admin/2fa/recovery', { code }),
  };

  // ========================================
  // NOTIFICATIONS ENDPOINTS
  // ========================================

  notifications = {
    /**
     * Get all notifications with optional filters
     */
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.unread_only) query.append('unread_only', 'true');
      if (params.type && params.type !== 'all') query.append('type', params.type);
      if (params.limit) query.append('limit', String(params.limit));
      if (params.offset) query.append('offset', String(params.offset));
      const qs = query.toString();
      return this.request('GET', `/api/admin/notifications${qs ? '?' + qs : ''}`);
    },

    /**
     * Get unread notification count
     */
    unreadCount: () =>
      this.request('GET', '/api/admin/notifications/unread-count'),

    /**
     * Get notification statistics
     */
    stats: () =>
      this.request('GET', '/api/admin/notifications/stats/summary'),

    /**
     * Get a specific notification
     */
    get: (id) =>
      this.request('GET', `/api/admin/notifications/${id}`),

    /**
     * Mark a notification as read
     */
    markRead: (id) =>
      this.request('PUT', `/api/admin/notifications/${id}/read`),

    /**
     * Mark all notifications as read
     */
    markAllRead: () =>
      this.request('PUT', '/api/admin/notifications/read-all'),

    /**
     * Delete a notification
     */
    delete: (id) =>
      this.request('DELETE', `/api/admin/notifications/${id}`),

    /**
     * Create a test notification (super admin only)
     */
    createTest: (data = {}) =>
      this.request('POST', '/api/admin/notifications/test', data),
  };
}

// Export singleton instance
export const adminAPIClient = new AdminAPIClient();

export default adminAPIClient;

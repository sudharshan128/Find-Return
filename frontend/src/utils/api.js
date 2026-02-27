/**
 * Trust Score API Client
 * 
 * Calls the backend trust score endpoints with Supabase auth token.
 * Used by TrustScoreHistory, AdminTrustOverride, and useTrustScore hook.
 */
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

/**
 * Get the current user's access token from Supabase session
 */
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

/**
 * Make an authenticated request to the backend.
 * Times out after 15 seconds to prevent infinite hangs.
 */
export const authFetch = async (endpoint, options = {}) => {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const url = `${API_BASE_URL}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || errorData.message || `API request failed: ${response.statusText}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return response.json();
};

/**
 * Trust Score API methods
 */
export const trustScoreAPI = {
  /**
   * Get the current user's trust score
   */
  getMyScore: () => authFetch('/api/trust-score/me'),

  /**
   * Get the current user's trust score logs (history)
   */
  getMyLogs: (limit = 50) => authFetch(`/api/trust-score/me/logs?limit=${limit}`),

  /**
   * Get the current user's trust summary
   */
  getMySummary: () => authFetch('/api/trust-score/me/summary'),

  /**
   * Update profile completion status (triggers trust score update)
   */
  updateProfileCompletion: () => authFetch('/api/trust-score/profile-completion', { method: 'POST' }),

  // ---- Admin endpoints ----

  /**
   * Get any user's trust score (admin only)
   */
  getUserScore: (userId) => authFetch(`/api/trust-score/user/${userId}`),

  /**
   * Get any user's trust logs (admin only)
   */
  getUserLogs: (userId, limit = 50) => authFetch(`/api/trust-score/user/${userId}/logs?limit=${limit}`),

  /**
   * Override a user's trust score (admin only)
   */
  adminOverride: (userId, { newScore, reason }) =>
    authFetch(`/api/trust-score/admin/override/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ newScore, reason }),
    }),

  /**
   * Get trust statistics dashboard (admin only)
   */
  getStatistics: () => authFetch('/api/trust-score/admin/statistics'),

  /**
   * Get top trusted users (admin only)
   */
  getTopUsers: (limit = 10) => authFetch(`/api/trust-score/admin/top-users?limit=${limit}`),

  /**
   * Get risky users (admin only)
   */
  getRiskyUsers: (limit = 50) => authFetch(`/api/trust-score/admin/risky-users?limit=${limit}`),

  /**
   * Manual trust update (admin only)
   */
  manualUpdate: ({ userId, actionType, pointsChange, reason, metadata }) =>
    authFetch('/api/trust-score/admin/manual-update', {
      method: 'POST',
      body: JSON.stringify({ userId, actionType, pointsChange, reason, metadata }),
    }),
};

export default trustScoreAPI;

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { trustScoreAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Trust level configuration — matches the 5-tier system from the backend
 */
const TRUST_LEVELS = {
  'Risky User': { min: 0, max: 30, color: '#ef4444', bg: '#fef2f2', icon: '⚠️' },
  'Fair Trust': { min: 31, max: 50, color: '#f59e0b', bg: '#fffbeb', icon: '🔶' },
  'Good Trust': { min: 51, max: 70, color: '#3b82f6', bg: '#eff6ff', icon: '✅' },
  'High Trust': { min: 71, max: 85, color: '#8b5cf6', bg: '#f5f3ff', icon: '⭐' },
  'Verified Trusted Member': { min: 86, max: 100, color: '#10b981', bg: '#ecfdf5', icon: '🛡️' },
};

/**
 * Calculate trust level from score
 */
export const getTrustLevelFromScore = (score) => {
  if (score >= 86) return 'Verified Trusted Member';
  if (score >= 71) return 'High Trust';
  if (score >= 51) return 'Good Trust';
  if (score >= 31) return 'Fair Trust';
  return 'Risky User';
};

/**
 * Get trust level details (color, bg, icon) from score
 */
export const getTrustLevelDetails = (score) => {
  const level = getTrustLevelFromScore(score);
  return { level, ...TRUST_LEVELS[level] };
};

/**
 * useTrustScore — Custom hook for real-time trust score tracking
 * 
 * Features:
 * - Fetches initial trust score from user profile
 * - Subscribes to Supabase Realtime for instant updates
 * - Provides trust level, color, and metadata
 * - Falls back gracefully if backend API is unavailable
 */
export const useTrustScore = (userId = null) => {
  const { user, profile, refreshProfile } = useAuth();
  const effectiveUserId = userId || user?.id;

  // Use null to indicate "not yet loaded" so components don't flash 50.
  const [trustScore, setTrustScore] = useState(profile?.trust_score ?? null);
  const [trustLevel, setTrustLevel] = useState(getTrustLevelFromScore(profile?.trust_score ?? 50));
  const [trustLogs, setTrustLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevScoreRef = useRef(profile?.trust_score ?? 50);
  const [scoreChange, setScoreChange] = useState(null);

  // Update when profile changes (e.g., refreshProfile is called)
  useEffect(() => {
    if (profile?.trust_score !== undefined) {
      const newScore = profile.trust_score;
      if (newScore !== prevScoreRef.current) {
        setScoreChange(newScore - prevScoreRef.current);
        prevScoreRef.current = newScore;
        // Clear change indicator after animation
        setTimeout(() => setScoreChange(null), 3000);
      }
      setTrustScore(newScore);
      setTrustLevel(getTrustLevelFromScore(newScore));
    }
  }, [profile?.trust_score]);

  // Subscribe to real-time trust score changes via Supabase Realtime
  useEffect(() => {
    if (!effectiveUserId) return;

    const channel = supabase
      .channel(`trust-score-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${effectiveUserId}`,
        },
        (payload) => {
          const newScore = payload.new.trust_score;
          if (newScore !== undefined && newScore !== prevScoreRef.current) {
            console.log(`[TRUST] Real-time update: ${prevScoreRef.current} → ${newScore}`);
            setScoreChange(newScore - prevScoreRef.current);
            prevScoreRef.current = newScore;
            setTrustScore(newScore);
            setTrustLevel(getTrustLevelFromScore(newScore));
            // Refresh the auth profile to keep everything in sync
            refreshProfile?.();
            // Clear change indicator after animation
            setTimeout(() => setScoreChange(null), 3000);
          }
        }
      )
      .subscribe();

    setLoading(false);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, refreshProfile]);

  // Fetch trust logs
  const fetchLogs = useCallback(async (limit = 20) => {
    if (!effectiveUserId) return;
    setLogsLoading(true);
    try {
      const response = await trustScoreAPI.getMyLogs(limit);
      if (response.success && response.data) {
        setTrustLogs(response.data);
      }
    } catch (err) {
      console.warn('[TRUST] Failed to fetch logs from API, trying direct query:', err.message);
      // Fallback: try direct Supabase query for trust_logs
      try {
        const { data } = await supabase
          .from('trust_logs')
          .select('*')
          .eq('user_id', effectiveUserId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (data) {
          setTrustLogs(data.map(log => ({
            id: log.id,
            actionType: log.action_type,
            pointsChange: log.points_change,
            previousScore: log.previous_score,
            newScore: log.new_score,
            reason: log.reason,
            createdAt: log.created_at,
          })));
        }
      } catch (fallbackErr) {
        console.warn('[TRUST] Fallback logs query failed:', fallbackErr.message);
      }
    } finally {
      setLogsLoading(false);
    }
  }, [effectiveUserId]);

  // Use score??50 so levelDetails never flashes "Risky User" while loading
  const levelDetails = getTrustLevelDetails(trustScore ?? 50);

  return {
    // Core data
    trustScore,
    trustLevel,
    levelDetails,
    scoreChange,

    // Logs
    trustLogs,
    fetchLogs,
    logsLoading,

    // State
    loading,
    error,

    // Helpers
    getTrustLevelFromScore,
    getTrustLevelDetails,
  };
};

export default useTrustScore;

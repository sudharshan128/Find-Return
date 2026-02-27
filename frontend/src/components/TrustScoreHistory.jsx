import React, { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Shield, AlertCircle } from 'lucide-react';
import { trustScoreAPI } from '../utils/api';
import { supabase } from '../lib/supabase';

const actionTypeLabels = {
  email_verified: 'Email Verified',
  profile_completed: 'Profile Completed',
  claim_approved: 'Claim Approved',
  claim_rejected: 'Claim Rejected',
  item_returned: 'Item Returned',
  spam_item_detected: 'Spam Item Detected',
  chat_completed_no_complaint: 'Chat Completed',
  abuse_report_confirmed: 'Abuse Report Confirmed',
  admin_flag: 'Admin Flag',
  active_30_days_no_abuse: '30 Days Active',
  admin_override: 'Admin Override',
};

const TrustScoreHistory = ({
  userId,
  limit = 20,
  className = '',
}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrustLogs();
  }, [userId, limit]);

  const fetchTrustLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try backend API first
      try {
        let response;
        if (userId) {
          response = await trustScoreAPI.getUserLogs(userId, limit);
        } else {
          response = await trustScoreAPI.getMyLogs(limit);
        }

        if (response.success && response.data) {
          setLogs(response.data);
          return;
        }
      } catch (apiErr) {
        console.warn('[TRUST] API unavailable, trying direct query:', apiErr.message);
      }

      // Fallback: query trust_logs directly from Supabase
      const targetUserId = userId || (await supabase.auth.getUser()).data?.user?.id;
      if (targetUserId) {
        const { data } = await supabase
          .from('trust_logs')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (data) {
          setLogs(data.map(log => ({
            id: log.id,
            actionType: log.action_type,
            pointsChange: log.points_change,
            previousScore: log.previous_score,
            newScore: log.new_score,
            previousLevel: log.previous_level || '',
            newLevel: log.new_level || '',
            reason: log.reason,
            adminId: log.admin_id,
            createdAt: log.created_at,
          })));
          return;
        }
      }
      
      setLogs([]);
    } catch (err) {
      console.error('Error fetching trust logs:', err);
      setError(err.message || 'Failed to load trust score history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-200 h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-8 text-center ${className}`}>
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No trust score history yet</p>
        <p className="text-gray-500 text-sm mt-1">
          Your trust score changes will appear here
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Trust Score History
        </h3>
        <span className="text-sm text-gray-500">{logs.length} events</span>
      </div>

      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left side: Icon and details */}
              <div className="flex items-start gap-3 flex-1">
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    log.pointsChange > 0
                      ? 'bg-green-100 text-green-600'
                      : log.pointsChange < 0
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {log.pointsChange > 0 ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : log.pointsChange < 0 ? (
                    <TrendingDown className="w-5 h-5" />
                  ) : (
                    <Shield className="w-5 h-5" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">
                      {actionTypeLabels[log.actionType] || log.actionType}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        log.pointsChange > 0
                          ? 'bg-green-100 text-green-700'
                          : log.pointsChange < 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {log.pointsChange > 0 ? '+' : ''}
                      {log.pointsChange}
                    </span>
                  </div>

                  {log.reason && (
                    <p className="text-sm text-gray-600 mb-2">{log.reason}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {log.previousScore} → {log.newScore}
                      </span>
                    </div>
                    {log.previousLevel !== log.newLevel && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                        Level Changed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right side: Score change */}
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900">
                  {log.newScore}
                </div>
                <div className="text-xs text-gray-500">{log.newLevel}</div>
              </div>
            </div>

            {/* Admin override indicator */}
            {log.adminId && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Admin Action
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustScoreHistory;

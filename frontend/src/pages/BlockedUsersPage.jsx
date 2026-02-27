/**
 * Blocked Users Management Page
 * View and unblock users
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Ban, X } from 'lucide-react';

const BlockedUsersPage = () => {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState(null);

  useEffect(() => {
    if (user) {
      loadBlockedUsers();
    }
  }, [user]);

  const loadBlockedUsers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          *,
          blocked:user_profiles!blocked_users_blocked_id_fkey(
            user_id,
            full_name,
            avatar_url
          )
        `)
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlockedUsers(data || []);
    } catch (error) {
      console.error('Failed to load blocked users:', error);
      toast.error('Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedUserId, userName) => {
    try {
      setUnblocking(blockedUserId);

      const { error } = await supabase.rpc('unblock_user', {
        p_blocked_id: blockedUserId
      });

      if (error) throw error;

      toast.success(`${userName} has been unblocked`);
      setBlockedUsers((prev) => prev.filter((b) => b.blocked_id !== blockedUserId));
    } catch (error) {
      console.error('Failed to unblock user:', error);
      toast.error('Failed to unblock user');
    } finally {
      setUnblocking(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="body-text">Loading blocked users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="section-card">
          <div className="flex items-center space-x-3 mb-6">
            <Ban className="h-6 w-6 text-red-600" />
            <h1 className="page-title">Blocked Users</h1>
          </div>

          {blockedUsers.length === 0 ? (
            <div className="text-center py-12">
              <Ban className="h-12 w-12 text-ink-subtle/40 mx-auto mb-4" />
              <p className="body-text">You haven't blocked any users</p>
              <p className="caption mt-2">
                Blocked users won't be able to send you messages
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-4 border border-surface-border rounded-xl hover:bg-surface-muted transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {block.blocked.avatar_url ? (
                      <img
                        src={block.blocked.avatar_url}
                        alt={block.blocked.full_name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-surface-border flex items-center justify-center">
                        <Ban className="h-5 w-5 text-ink-subtle" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">
                        {block.blocked.full_name}
                      </p>
                      {block.reason && (
                        <p className="caption truncate">
                          Reason: {block.reason}
                        </p>
                      )}
                      <p className="caption">
                        Blocked {new Date(block.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnblock(block.blocked_id, block.blocked.full_name)}
                    disabled={unblocking === block.blocked_id}
                    className="ml-4 btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {unblocking === block.blocked_id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Unblocking...</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4" />
                        <span>Unblock</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 bg-primary-50 border border-primary-100 rounded-xl p-4">
          <h3 className="font-semibold text-primary-900 mb-2">About Blocking</h3>
          <ul className="body-text text-primary-800 space-y-1">
            <li>• Blocked users cannot send you messages in any chat</li>
            <li>• They won't be notified that you've blocked them</li>
            <li>• You can unblock users at any time</li>
            <li>• Existing messages from blocked users remain visible</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BlockedUsersPage;

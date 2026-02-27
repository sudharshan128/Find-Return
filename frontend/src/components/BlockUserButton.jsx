/**
 * User Blocking UI Component
 * Allows users to block / unblock participants
 */

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Ban, X, AlertTriangle, CheckCircle } from 'lucide-react';

const BlockUserButton = ({ userId, userName, chatId, onBlocked, onUnblocked, isBlocked = false }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState('');

  const handleBlock = async () => {
    try {
      setBlocking(true);

      const { error } = await supabase.rpc('block_user', {
        p_blocked_id: userId,
        p_reason: reason || 'Inappropriate behavior',
        p_chat_id: chatId,
      });

      if (error) throw error;

      toast.success(`${userName} has been blocked`);
      setShowConfirm(false);
      if (onBlocked) onBlocked();
    } catch (error) {
      console.error('Failed to block user:', error);
      toast.error('Failed to block user');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async () => {
    try {
      setBlocking(true);

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId);

      if (error) throw error;

      toast.success(`${userName} has been unblocked`);
      if (onUnblocked) onUnblocked();
    } catch (error) {
      console.error('Failed to unblock user:', error);
      toast.error('Failed to unblock user');
    } finally {
      setBlocking(false);
    }
  };

  // Unblock button — shown when this user is already blocked
  if (isBlocked) {
    return (
      <button
        onClick={handleUnblock}
        disabled={blocking}
        data-block-btn
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        title="Unblock this user"
      >
        {blocking ? (
          <span className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
        <span>Unblock User</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        data-block-btn
        className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Block this user"
      >
        <Ban className="h-4 w-4" />
        <span>Block User</span>
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="text-lg font-bold">Block {userName}?</h3>
              </div>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Blocking this user will prevent them from sending you messages in any chat. 
              They won't be notified that you've blocked them.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Spam, harassment, inappropriate content..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={blocking}
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                disabled={blocking}
              >
                {blocking ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    <span>Blocking...</span>
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    <span>Block User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BlockUserButton;

/**
 * Admin Chat Controls Component
 * For moderating chats - freeze/unfreeze, delete messages
 */

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Lock, Unlock, Trash2, AlertTriangle } from 'lucide-react';

const AdminChatControls = ({ chat, onUpdate }) => {
  const [freezing, setFreezing] = useState(false);
  const [showFreezeDialog, setShowFreezeDialog] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');

  const handleFreeze = async () => {
    if (!freezeReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    try {
      setFreezing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('chats')
        .update({
          is_frozen: true,
          frozen_at: new Date().toISOString(),
          frozen_by: user.id,
          freeze_reason: freezeReason.trim(),
        })
        .eq('id', chat.id);

      if (error) throw error;

      // Log action
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'chat_frozen',
        resource_type: 'chat',
        resource_id: chat.id,
        details: { reason: freezeReason.trim() },
      });

      toast.success('Chat frozen successfully');
      setShowFreezeDialog(false);
      setFreezeReason('');
      onUpdate?.();
    } catch (err) {
      console.error('Error freezing chat:', err);
      toast.error('Failed to freeze chat');
    } finally {
      setFreezing(false);
    }
  };

  const handleUnfreeze = async () => {
    if (!confirm('Unfreeze this chat?')) return;

    try {
      setFreezing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('chats')
        .update({
          is_frozen: false,
          frozen_at: null,
          frozen_by: null,
          freeze_reason: null,
        })
        .eq('id', chat.id);

      if (error) throw error;

      // Log action
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'chat_unfrozen',
        resource_type: 'chat',
        resource_id: chat.id,
      });

      toast.success('Chat unfrozen successfully');
      onUpdate?.();
    } catch (err) {
      console.error('Error unfreezing chat:', err);
      toast.error('Failed to unfreeze chat');
    } finally {
      setFreezing(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
      <div className="flex items-center space-x-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <h3 className="font-semibold text-yellow-900">Admin Controls</h3>
      </div>

      <div className="space-y-2">
        {chat.is_frozen ? (
          <div>
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-2">
              <p className="text-sm text-red-800 font-medium">
                Chat is currently frozen
              </p>
              {chat.freeze_reason && (
                <p className="text-sm text-red-700 mt-1">
                  Reason: {chat.freeze_reason}
                </p>
              )}
            </div>
            <button
              onClick={handleUnfreeze}
              disabled={freezing}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 flex items-center justify-center space-x-2"
            >
              <Unlock className="h-4 w-4" />
              <span>{freezing ? 'Unfreezing...' : 'Unfreeze Chat'}</span>
            </button>
          </div>
        ) : (
          <div>
            {!showFreezeDialog ? (
              <button
                onClick={() => setShowFreezeDialog(true)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center space-x-2"
              >
                <Lock className="h-4 w-4" />
                <span>Freeze Chat</span>
              </button>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="Enter reason for freezing this chat..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleFreeze}
                    disabled={freezing || !freezeReason.trim()}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
                  >
                    {freezing ? 'Freezing...' : 'Confirm Freeze'}
                  </button>
                  <button
                    onClick={() => {
                      setShowFreezeDialog(false);
                      setFreezeReason('');
                    }}
                    disabled={freezing}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChatControls;

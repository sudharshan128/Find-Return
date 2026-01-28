/**
 * Admin Chats Page
 * Chat moderation with message viewing and freeze capabilities
 */

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import {
  MessageSquare,
  Eye,
  Snowflake,
  ThermometerSun,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  AlertTriangle,
  Search,
  Clock,
  Shield,
  MessageCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminChatsPage = () => {
  const { adminProfile, isSuperAdmin, isModerator, loading: authLoading } = useAdminAuth();
  
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [frozenOnly, setFrozenOnly] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // Modal states
  const [selectedChat, setSelectedChat] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Access justification state
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [pendingChatView, setPendingChatView] = useState(null);

  const fetchChats = useCallback(async () => {
    // Guard: only fetch if auth is ready
    if (authLoading || !adminProfile?.id) {
      console.log('[ADMIN CHATS] Auth not ready, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('[ADMIN CHATS] Fetching chats...');
      setLoading(true);
      setError(null);

      const result = await adminAPIClient.chats.getAll({
        page: pagination.page,
        limit: pagination.limit,
        frozen: frozenOnly || undefined,
        flagged: flaggedOnly || undefined,
      });
      setChats(result.data || []);
      setPagination(prev => ({ ...prev, total: result.total }));
      console.log('[ADMIN CHATS] Chats fetched:', (result.data || []).length);
    } catch (error) {
      console.error('[ADMIN CHATS] Error fetching chats:', error);
      setError(error.message || 'Failed to load chats');
      toast.error('Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, frozenOnly, flaggedOnly, authLoading, adminProfile?.id]);

  useEffect(() => {
    if (!authLoading && adminProfile?.id) {
      fetchChats();
    } else if (authLoading) {
      console.log('[ADMIN CHATS] Waiting for auth to load...');
    }
  }, [fetchChats, authLoading, adminProfile?.id]);

  const requestChatView = (chat) => {
    setPendingChatView(chat);
    setShowJustificationModal(true);
  };

  const handleJustificationSubmit = async (justification) => {
    try {
      // Log access with justification
      await adminAPIClient.chats.logAccess(pendingChatView.id, justification);
      
      // Fetch full chat with messages
      const fullChat = await adminAPIClient.chats.get(pendingChatView.id);
      setSelectedChat(fullChat);
      setShowJustificationModal(false);
      setShowViewModal(true);
      setPendingChatView(null);
    } catch (error) {
      console.error('Error accessing chat:', error);
      toast.error('Failed to access chat');
    }
  };

  const openActionModal = (chat, action) => {
    setSelectedChat(chat);
    setActionType(action);
    setShowActionModal(true);
  };

  const handleAction = async (reason) => {
    try {
      setActionLoading(true);

      switch (actionType) {
        case 'freeze':
          await adminAPIClient.chats.freeze(selectedChat.id, reason);
          toast.success('Chat frozen successfully');
          break;
        case 'unfreeze':
          await adminAPIClient.chats.unfreeze(selectedChat.id, reason);
          toast.success('Chat unfrozen successfully');
          break;
        case 'delete_message':
          // This is handled separately in the chat view modal
          break;
        default:
          break;
      }

      setShowActionModal(false);
      fetchChats();
    } catch (error) {
      console.error('Action error:', error);
      toast.error(`Failed to ${actionType}: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat Moderation</h1>
          <p className="text-gray-500">Monitor and moderate platform communications</p>
        </div>
        <button
          onClick={fetchChats}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Privacy Notice</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Chat message access is logged and requires justification. Only access chats when necessary for moderation purposes.
              All access is audited and reviewed for compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={frozenOnly}
              onChange={(e) => setFrozenOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Frozen Only</span>
          </label>

          <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Flagged Only</span>
          </label>

          <button
            onClick={fetchChats}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Chats Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No chats found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chat</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Messages</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {chats.map((chat) => (
                    <tr key={chat.id} className={`hover:bg-gray-50 ${chat.is_frozen ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900">{chat.id.slice(0, 8)}...</div>
                        {chat.is_flagged && (
                          <span className="text-xs text-red-600 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Flagged
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center" title={chat.finder_profile?.full_name}>
                            {chat.finder_profile?.avatar_url ? (
                              <img src={chat.finder_profile.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                            ) : (
                              <User className="h-4 w-4 text-gray-500" />
                            )}
                          </div>
                          <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center" title={chat.claimant_profile?.full_name}>
                            {chat.claimant_profile?.avatar_url ? (
                              <img src={chat.claimant_profile.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                            ) : (
                              <User className="h-4 w-4 text-gray-500" />
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {chat.finder_profile?.full_name?.split(' ')[0]} ↔ {chat.claimant_profile?.full_name?.split(' ')[0]}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-[150px] truncate">
                          {chat.items?.title || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          {chat.is_frozen ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Snowflake className="h-3 w-3 mr-1" />
                              Frozen
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{chat.message_count || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {chat.last_message_at ? (
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(chat.last_message_at).toLocaleDateString()}
                          </div>
                        ) : (
                          'No messages'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => requestChatView(chat)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="View messages (requires justification)"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {isModerator() && (
                            <>
                              {chat.is_frozen ? (
                                <button
                                  onClick={() => openActionModal(chat, 'unfreeze')}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                  title="Unfreeze chat"
                                >
                                  <ThermometerSun className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => openActionModal(chat, 'freeze')}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                  title="Freeze chat"
                                >
                                  <Snowflake className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page * pagination.limit >= pagination.total}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Justification Modal */}
      {showJustificationModal && pendingChatView && (
        <JustificationModal
          chat={pendingChatView}
          onSubmit={handleJustificationSubmit}
          onClose={() => {
            setShowJustificationModal(false);
            setPendingChatView(null);
          }}
        />
      )}

      {/* Chat View Modal */}
      {showViewModal && selectedChat && (
        <ChatViewModal
          chat={selectedChat}
          adminProfile={adminProfile}
          isSuperAdmin={isSuperAdmin}
          onClose={() => {
            setShowViewModal(false);
            setSelectedChat(null);
          }}
          onRefresh={fetchChats}
        />
      )}

      {/* Action Modal */}
      {showActionModal && selectedChat && (
        <ActionConfirmModal
          chat={selectedChat}
          actionType={actionType}
          loading={actionLoading}
          onConfirm={handleAction}
          onClose={() => setShowActionModal(false)}
        />
      )}
    </div>
  );
};

// Justification Modal
const JustificationModal = ({ chat, onSubmit, onClose }) => {
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(justification);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Access Justification Required</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Privacy Protection</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  You are about to view private messages between users. This access will be logged for audit purposes.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Chat between:</p>
            <p className="text-sm font-medium text-gray-900">
              {chat.finder_profile?.full_name} ↔ {chat.claimant_profile?.full_name}
            </p>
            <p className="text-xs text-gray-500">Regarding: {chat.items?.title}</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Access <span className="text-red-500">*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={3}
              required
              placeholder="Explain why you need to view this chat..."
              minLength={20}
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 20 characters required</p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || justification.length < 20}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Access Chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Chat View Modal
const ChatViewModal = ({ chat, adminProfile, isSuperAdmin, onClose, onRefresh }) => {
  const [messages, setMessages] = useState(chat.messages || []);
  const [deleteLoading, setDeleteLoading] = useState(null);

  const handleDeleteMessage = async (messageId, reason) => {
    try {
      setDeleteLoading(messageId);
      await adminAPIClient.chats.deleteMessage(chat.id, messageId, reason);
      setMessages(messages.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Chat Messages</h2>
            <p className="text-sm text-gray-500">
              {chat.finder_profile?.full_name} ↔ {chat.claimant_profile?.full_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Chat Info */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Item: {chat.items?.title}</span>
            {chat.is_frozen && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <Snowflake className="h-3 w-3 mr-1" />
                Frozen
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px] max-h-[500px]">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              No messages in this chat
            </div>
          ) : (
            messages.map((message) => {
              const isFromFinder = message.sender_id === chat.finder_id;
              const senderProfile = isFromFinder ? chat.finder_profile : chat.claimant_profile;

              return (
                <div key={message.id} className={`flex ${isFromFinder ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[70%] ${isFromFinder ? 'order-2' : 'order-1'}`}>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {senderProfile?.full_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className={`relative group p-3 rounded-lg ${
                      isFromFinder ? 'bg-gray-100' : 'bg-indigo-100'
                    } ${message.is_deleted ? 'opacity-50' : ''}`}>
                      {message.is_deleted ? (
                        <p className="text-sm text-gray-500 italic">Message deleted by admin</p>
                      ) : (
                        <>
                          <p className="text-sm text-gray-800">{message.content}</p>
                          {isSuperAdmin() && (
                            <button
                              onClick={() => {
                                const reason = prompt('Reason for deleting this message:');
                                if (reason) handleDeleteMessage(message.id, reason);
                              }}
                              disabled={deleteLoading === message.id}
                              className="absolute top-1 right-1 p-1 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-opacity"
                              title="Delete message"
                            >
                              {deleteLoading === message.id ? (
                                <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              This access has been logged for audit purposes
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Action Confirm Modal
const ActionConfirmModal = ({ chat, actionType, loading, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');

  const actionConfigs = {
    freeze: {
      title: 'Freeze Chat',
      description: 'This will prevent both parties from sending new messages. They will still be able to read existing messages.',
      confirmText: 'Freeze Chat',
      confirmClass: 'bg-blue-600 hover:bg-blue-700',
    },
    unfreeze: {
      title: 'Unfreeze Chat',
      description: 'This will allow both parties to resume sending messages.',
      confirmText: 'Unfreeze Chat',
      confirmClass: 'bg-green-600 hover:bg-green-700',
    },
  };

  const config = actionConfigs[actionType] || { title: 'Action', description: '', confirmText: 'Confirm', confirmClass: 'bg-indigo-600' };

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Chat between:</p>
            <p className="text-sm font-medium text-gray-900">
              {chat.finder_profile?.full_name} ↔ {chat.claimant_profile?.full_name}
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={3}
              required
              placeholder="Enter reason for this action..."
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${config.confirmClass}`}
            >
              {loading ? 'Processing...' : config.confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminChatsPage;

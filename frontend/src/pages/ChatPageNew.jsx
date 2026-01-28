/**
 * Production-Ready Chat Page Component
 * Use this to replace your current ChatPage.jsx
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  ChevronLeft, 
  Send, 
  Lock,
  AlertTriangle,
  Loader2,
  Shield
} from 'lucide-react';
import { 
  getChatKey, 
  encryptMessage, 
  decryptMessage,
  isEncryptionSupported 
} from '../utils/encryption';
import BlockUserButton from '../components/BlockUserButton';

const ChatPage = () => {
  const { id: chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [otherParticipant, setOtherParticipant] = useState(null);
  const [error, setError] = useState(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [chatKey, setChatKey] = useState(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize encryption - DISABLED for now (causes decryption issues)
  // Messages are stored in plain text for reliability
  useEffect(() => {
    // Encryption disabled - set to false
    setEncryptionEnabled(false);
    setChatKey(null);
  }, [chatId]);

  // Load chat and messages
  useEffect(() => {
    if (!chatId || !user) return;

    loadChat();
    markMessagesAsRead();
    
    // Real-time subscription for new messages
    const messagesChannel = supabase
      .channel(`chat:${chatId}:messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          // Fetch full message with sender info
          const { data: newMsg } = await supabase
            .from('messages')
            .select(`
              *,
              sender:user_profiles!messages_sender_id_fkey(user_id, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newMsg && !newMsg.is_deleted) {
            // Decrypt if encrypted
            if (newMsg.is_encrypted && chatKey) {
              try {
                newMsg.message_text = await decryptMessage(newMsg.message_text, chatKey);
              } catch (error) {
                console.error('Failed to decrypt message:', error);
                newMsg.message_text = '[Encrypted message - unable to decrypt]';
              }
            }
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();
            
            // Mark as read if not from current user
            if (newMsg.sender_id !== user.id) {
              setTimeout(markMessagesAsRead, 500);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to chat updates (frozen/closed status)
    const chatChannel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
          filter: `id=eq.${chatId}`,
        },
        (payload) => {
          setChat((prev) => ({ ...prev, ...payload.new }));
          
          // Show toast on status changes
          if (payload.new.is_frozen && !payload.old.is_frozen) {
            toast.error('This chat has been frozen by an administrator');
          }
          if (payload.new.is_closed && !payload.old.is_closed) {
            toast('This chat has been closed', { icon: '🔒' });
          }
        }
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
      chatChannel.unsubscribe();
    };
  }, [chatId, user]);

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChat = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch chat with all related data
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select(`
          *,
          item:items!inner(
            id, 
            title, 
            status,
            item_images(image_url, is_primary)
          ),
          claim:claims!inner(id, status),
          finder:user_profiles!chats_finder_id_fkey(user_id, full_name, avatar_url),
          claimant:user_profiles!chats_claimant_id_fkey(user_id, full_name, avatar_url)
        `)
        .eq('id', chatId)
        .single();

      if (chatError) throw chatError;
      if (!chatData) throw new Error('Chat not found');

      // Authorization check
      if (chatData.finder_id !== user.id && chatData.claimant_id !== user.id) {
        throw new Error('You are not authorized to view this chat');
      }

      setChat(chatData);
      
      // Determine other participant
      const other = chatData.finder_id === user.id ? chatData.claimant : chatData.finder;
      setOtherParticipant(other);

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:user_profiles!messages_sender_id_fkey(user_id, full_name, avatar_url)
        `)
        .eq('chat_id', chatId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Decrypt messages if encrypted
      const decryptedMessages = await Promise.all(
        (messagesData || []).map(async (msg) => {
          if (msg.is_encrypted && chatKey) {
            try {
              msg.message_text = await decryptMessage(msg.message_text, chatKey);
            } catch (error) {
              console.error('Failed to decrypt message:', error);
              msg.message_text = '[Encrypted message - unable to decrypt]';
            }
          }
          return msg;
        })
      );

      setMessages(decryptedMessages);
    } catch (err) {
      console.error('Error loading chat:', err);
      setError(err.message);
      toast.error(err.message);
      
      // Redirect to chats list after error
      setTimeout(() => navigate('/chats'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      // Mark all unread messages from other user as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      // Update chat unread count
      if (chat) {
        const updateField = chat.finder_id === user.id 
          ? 'finder_unread_count' 
          : 'claimant_unread_count';
        
        await supabase
          .from('chats')
          .update({ [updateField]: 0 })
          .eq('id', chatId);
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    const text = newMessage.trim();
    if (!text || sending) return;

    // Validation
    if (text.length > 2000) {
      toast.error('Message is too long (max 2000 characters)');
      return;
    }

    // Check if chat allows messages
    if (!chat.enabled || chat.is_closed || chat.is_frozen) {
      const reason = chat.is_frozen 
        ? 'This chat has been frozen by an administrator'
        : chat.is_closed
        ? 'This chat has been closed'
        : 'This chat is disabled';
      toast.error(reason);
      return;
    }

    try {
      setSending(true);
      
      // Encrypt message if encryption is enabled
      let messageToSend = text;
      let isEncrypted = false;
      
      if (encryptionEnabled && chatKey) {
        try {
          messageToSend = await encryptMessage(text, chatKey);
          isEncrypted = true;
        } catch (error) {
          console.error('Encryption failed, sending unencrypted:', error);
        }
      }
      
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          message_text: messageToSend,
          is_encrypted: isEncrypted,
          encryption_version: isEncrypted ? 'v1' : null,
        })
        .select(`
          *,
          sender:user_profiles!messages_sender_id_fkey(user_id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      setNewMessage('');
      // Message will be added via real-time subscription
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // Error state
  if (error || !chat) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-600 mb-4">{error || 'Chat not found'}</p>
        <button
          onClick={() => navigate('/chats')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Back to Chats
        </button>
      </div>
    );
  }

  const canSendMessages = chat.enabled && !chat.is_closed && !chat.is_frozen;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Left side - Back button and participant info */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/chats')}
              className="p-2 hover:bg-gray-100 rounded-full transition"
              aria-label="Back to chats"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            
            {otherParticipant && (
              <div className="flex items-center space-x-3">
                {otherParticipant.avatar_url ? (
                  <img
                    src={otherParticipant.avatar_url}
                    alt={otherParticipant.full_name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                    {otherParticipant.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {otherParticipant.full_name}
                  </h2>
                  {chat.item && (
                    <Link 
                      to={`/items/${chat.item.id}`}
                      className="text-sm text-blue-600 hover:underline flex items-center space-x-1"
                    >
                      <span className="truncate max-w-[200px]">{chat.item.title}</span>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right side - Status indicators */}
          <div className="flex items-center space-x-2">
            {otherParticipant && (
              <BlockUserButton
                userId={otherParticipant.user_id}
                userName={otherParticipant.full_name}
                chatId={chatId}
                onBlocked={() => {
                  navigate('/chats');
                }}
              />
            )}
            {encryptionEnabled && (
              <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-3 py-1 rounded-full" title="End-to-end encrypted">
                <Shield className="h-4 w-4" />
                <span className="text-xs font-medium">E2EE</span>
              </div>
            )}
            {chat.is_frozen && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 px-3 py-1 rounded-full">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Frozen</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Status Banners */}
          {!chat.enabled && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mx-auto mb-2" />
              <p className="text-sm text-yellow-800 font-medium">This chat has been disabled</p>
            </div>
          )}
          
          {chat.is_closed && (
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-center">
              <Lock className="h-5 w-5 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-700 font-medium">This chat has been closed</p>
            </div>
          )}

          {chat.is_frozen && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-red-800 mb-2">
                <Lock className="h-5 w-5" />
                <span className="font-semibold">Chat Frozen by Administrator</span>
              </div>
              {chat.freeze_reason && (
                <p className="text-sm text-red-700">Reason: {chat.freeze_reason}</p>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Send className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No messages yet</p>
              <p className="text-gray-400 text-sm mt-1">Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.sender_id === user.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl shadow-sm ${
                      isMine
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                    }`}
                  >
                    <p className="break-words whitespace-pre-wrap">{message.message_text}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isMine ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          {canSendMessages ? (
            <form onSubmit={sendMessage} className="flex space-x-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                maxLength={2000}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 transition shadow-md hover:shadow-lg"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-sm font-medium">
                {chat.is_frozen
                  ? '🔒 This chat has been frozen by an administrator'
                  : chat.is_closed
                  ? '🔒 This chat has been closed'
                  : '⚠️ This chat is disabled'}
              </p>
            </div>
          )}
          
          {/* Character count */}
          {newMessage.length > 0 && canSendMessages && (
            <div className="text-right mt-1">
              <span className={`text-xs ${newMessage.length > 1800 ? 'text-red-600' : 'text-gray-400'}`}>
                {newMessage.length}/2000
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

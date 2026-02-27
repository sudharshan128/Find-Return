/**
 * Chat Page - Production Ready with Security & Real-time
 * Real-time chat between finder and approved claimant
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { supabase, db, realtime } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  ChevronLeft, 
  Send, 
  Flag,
  CheckCheck,
  Info,
  Gift,
  Loader2,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

const ChatPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch: refetchUnreadCount } = useUnreadCount();
  const messagesEndRef = useRef(null);
  
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [markingReturned, setMarkingReturned] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Fetch chat and messages
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        console.log('[CHAT] Fetching chat data:', id);
        setLoading(true);
        setError(null);

        // Get chat details
        const chatData = await db.chats.get(id);
        
        if (!isMounted) return;

        // Verify access
        if (chatData.finder_id !== user.id && chatData.claimant_id !== user.id) {
          console.log('[CHAT] Unauthorized access attempt');
          toast.error('You do not have access to this chat');
          navigate('/chats');
          return;
        }
        
        console.log('[CHAT] Chat authorized, loading messages...');
        setChat(chatData);

        // Get messages
        const messagesData = await db.messages.getForChat(id);
        
        if (isMounted) {
          setMessages(messagesData || []);
          console.log('[CHAT] Messages loaded:', (messagesData || []).length);

          // Mark messages as read + reset unread counter in chats table
          await db.messages.markRead(id, user.id);
          await db.chats.markRead(id, user.id, chatData.finder_id === user.id);
          console.log('[CHAT] Marked as read, refetching unread count...');
          // Force immediate badge update
          refetchUnreadCount();
        }
      } catch (err) {
        console.error('[CHAT] Error fetching chat:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load chat');
          toast.error('Failed to load chat');
          setTimeout(() => navigate('/chats'), 2000);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [id, user.id, navigate]);

  // Subscribe to new messages
  useEffect(() => {
    if (!chat) return;

    const channel = realtime.subscribeToChat(id, (payload) => {
      if (payload.new) {
        setMessages((prev) => [...prev, payload.new]);
        // Mark as read if message is from other user
        if (payload.new.sender_id !== user.id) {
          db.messages.markRead(id, user.id);
          // Also zero out the unread counter so the navbar badge clears
          if (chat) {
            db.chats.markRead(id, user.id, chat.finder_id === user.id);
            console.log('[CHAT] New message marked as read, refetching count...');
            refetchUnreadCount();
          }
        }
      }
    });

    return () => {
      realtime.unsubscribe(channel);
    };
  }, [id, chat, user.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    const message = newMessage.trim();
    if (!message) return;

    setSending(true);
    try {
      await db.messages.send(id, user.id, message);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleMarkReturned = async () => {
    if (!chat?.item?.id) return;
    
    setMarkingReturned(true);
    try {
      await db.items.markReturned(chat.item.id, chat.claim_id);
      
      // Update local state
      setChat(prev => ({
        ...prev,
        item: { ...prev.item, status: 'returned' }
      }));
      
      toast.success('🎉 Item marked as returned! Thank you for helping reunite this item with its owner.');
      setShowReturnConfirm(false);
    } catch (error) {
      console.error('Error marking as returned:', error);
      toast.error('Failed to mark item as returned');
    } finally {
      setMarkingReturned(false);
    }
  };

  const formatMessageDate = (date) => {
    const d = new Date(date);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
  };

  const formatMessageTime = (date) => {
    return format(new Date(date), 'h:mm a');
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-surface-border rounded w-1/3 mb-6" />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? '' : 'justify-end'}`}>
                  <div className={`h-16 bg-surface-border rounded-2xl w-2/3`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isFinder = chat?.finder_id === user.id;
  const otherPersonRole = isFinder ? 'Claimant' : 'Finder';
  const canMarkReturned = isFinder && chat?.item?.status !== 'returned';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-surface-card border-b px-4 py-3">
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/chats')}
              className="p-2 -ml-2 hover:bg-surface-muted rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {chat?.item && (
              <Link to={`/items/${chat.item.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div>
                  <h1 className="font-semibold text-ink truncate">
                    {chat.item.title}
                  </h1>
                  <p className="caption">
                    Chatting with {otherPersonRole}
                    {chat.item.status === 'returned' && (
                      <span className="ml-2 text-green-600">✓ Returned</span>
                    )}
                  </p>
                </div>
              </Link>
            )}

            {canMarkReturned && (
              <button 
                onClick={() => setShowReturnConfirm(true)}
                className="btn btn-success btn-sm flex items-center gap-1"
              >
                <Gift className="w-4 h-4" />
                <span className="hidden sm:inline">Mark Returned</span>
              </button>
            )}

            <button 
              onClick={() => setShowReportModal(true)}
              className="p-2 text-ink-muted hover:bg-surface-muted rounded-lg"
              title="Report"
            >
              <Flag className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Safety Banner for in-person meetups */}
      {chat?.item?.status !== 'returned' && (
        <SafetyBanner type="meetup" className="border-b" />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="container mx-auto max-w-2xl">
          {Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 bg-surface-muted rounded-full text-xs text-ink-subtle">
                  {formatMessageDate(dateMessages[0].created_at)}
                </span>
              </div>

              {/* Messages for this date */}
              {dateMessages.map((message, index) => {
                const isOwnMessage = message.sender_id === user.id;
                const showAvatar = 
                  !isOwnMessage && 
                  (index === 0 || dateMessages[index - 1]?.sender_id !== message.sender_id);

                return (
                  <div
                    key={message.id}
                    className={`flex mb-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isOwnMessage && showAvatar && message.sender && (
                      <img
                        src={message.sender.avatar_url || `https://ui-avatars.com/api/?name=${message.sender.full_name}&background=3b82f6&color=fff`}
                        alt=""
                        className="w-8 h-8 rounded-full mr-2 flex-shrink-0"
                      />
                    )}
                    {!isOwnMessage && !showAvatar && (
                      <div className="w-8 mr-2 flex-shrink-0" />
                    )}

                    <div
                      className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                        isOwnMessage
                          ? 'bg-primary-600 text-white rounded-br-sm'
                          : 'bg-surface-muted text-ink rounded-bl-sm'
                      }`}
                    >
                      <p className="break-words">{message.message_text || message.message}</p>
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 ${
                          isOwnMessage ? 'text-primary-200' : 'text-ink-subtle'
                        }`}
                      >
                        <span className="text-xs">{formatMessageTime(message.created_at)}</span>
                        {isOwnMessage && message.is_read && (
                          <CheckCheck className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="body-text">No messages yet. Start the conversation!</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      {chat?.is_active ? (
        <div className="bg-surface-card border-t px-4 py-3">
          <div className="container mx-auto max-w-2xl">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="input flex-1"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="btn btn-primary px-4"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-surface-muted border-t px-4 py-3 text-center">
          <p className="body-text">This chat has been closed</p>
        </div>
      )}

      {/* Mark as Returned Confirmation */}
      <ConfirmDialog
        isOpen={showReturnConfirm}
        onClose={() => setShowReturnConfirm(false)}
        onConfirm={handleMarkReturned}
        title="Mark Item as Returned"
        message="Are you sure you want to mark this item as returned to its owner? This action will complete the claim process and cannot be undone."
        confirmText={markingReturned ? 'Processing...' : 'Yes, Item Returned'}
        cancelText="Cancel"
        variant="success"
        icon={<Gift className="w-6 h-6 text-green-600" />}
      />

      {/* Report Abuse Modal */}
      <ReportAbuseModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="user"
        targetId={isFinder ? chat?.claimant_id : chat?.finder_id}
        targetTitle={isFinder ? 'Claimant' : 'Finder'}
      />
    </div>
  );
};

export default ChatPage;

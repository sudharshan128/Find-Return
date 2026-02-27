/**
 * ChatPageNew - Production-grade messaging UI
 * WhatsApp-style layout: Header → Messages → Input
 * All Supabase logic preserved — only UI rebuilt.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  encryptMessage,
  decryptMessage,
} from '../utils/encryption';

// Chat UI components
import ChatHeader from '../components/chat/ChatHeader';
import ChatContainer from '../components/chat/ChatContainer';
import ChatInput from '../components/chat/ChatInput';

const ChatPage = () => {
  const { id: chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch: refetchUnreadCount } = useUnreadCount();
  const messagesEndRef = useRef(null);

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [otherParticipant, setOtherParticipant] = useState(null);
  const [error, setError] = useState(null);
  const [encryptionEnabled] = useState(false);
  const [chatKey] = useState(null);
  const [markingReturned, setMarkingReturned] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [hasBlockedOther, setHasBlockedOther] = useState(false);

  // ─── Helpers ───────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ─── Load chat + messages ─────────────────────────────────
  useEffect(() => {
    if (!chatId || !user) return;

    loadChat();
    markMessagesAsRead();

    // Real-time: new messages
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
          const { data: newMsg } = await supabase
            .from('messages')
            .select(`
              *,
              sender:user_profiles!messages_sender_id_fkey(user_id, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newMsg && !newMsg.is_deleted) {
            if (newMsg.is_encrypted && chatKey) {
              try {
                newMsg.message_text = await decryptMessage(newMsg.message_text, chatKey);
              } catch {
                newMsg.message_text = '[Encrypted message - unable to decrypt]';
              }
            }
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();

            if (newMsg.sender_id !== user.id) {
              setTimeout(markMessagesAsRead, 500);
            }
          }
        }
      )
      .subscribe();

    // Real-time: chat status updates
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
          if (!payload.new.enabled && payload.old.enabled) {
            toast.error('This chat has been disabled by an administrator');
          }
          if (payload.new.is_closed && !payload.old.is_closed) {
            toast('This chat has been closed', { icon: '🔒' });
          }
        }
      )
      .subscribe();

    // Real-time: block/unblock events
    const blockChannel = supabase
      .channel(`chat:${chatId}:blocks`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'blocked_users',
        },
        (payload) => {
          // Someone blocked the current user
          if (payload.new.blocked_id === user.id) {
            setIsBlockedByOther(true);
            toast.error('You can no longer send messages in this chat.', { id: 'blocked-toast' });
          }
          // Current user blocked someone
          if (payload.new.blocker_id === user.id) {
            setHasBlockedOther(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'blocked_users',
        },
        (payload) => {
          // Unblock event for current user
          if (payload.old.blocked_id === user.id) {
            setIsBlockedByOther(false);
          }
          if (payload.old.blocker_id === user.id) {
            setHasBlockedOther(false);
          }
        }
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
      chatChannel.unsubscribe();
      blockChannel.unsubscribe();
    };
  }, [chatId, user]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ─── Data fetching ────────────────────────────────────────
  const loadChat = async () => {
    try {
      setLoading(true);
      setError(null);

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

      if (chatData.finder_id !== user.id && chatData.claimant_id !== user.id) {
        throw new Error('You are not authorized to view this chat');
      }

      setChat(chatData);
      const other = chatData.finder_id === user.id ? chatData.claimant : chatData.finder;
      setOtherParticipant(other);

      // Check block status in both directions
      if (other?.user_id) {
        const { data: blockedByOtherData } = await supabase
          .from('blocked_users')
          .select('id')
          .eq('blocker_id', other.user_id)
          .eq('blocked_id', user.id)
          .maybeSingle();
        setIsBlockedByOther(!!blockedByOtherData);

        const { data: blockedOtherData } = await supabase
          .from('blocked_users')
          .select('id')
          .eq('blocker_id', user.id)
          .eq('blocked_id', other.user_id)
          .maybeSingle();
        setHasBlockedOther(!!blockedOtherData);
      }

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

      const decryptedMessages = await Promise.all(
        (messagesData || []).map(async (msg) => {
          if (msg.is_encrypted && chatKey) {
            try {
              msg.message_text = await decryptMessage(msg.message_text, chatKey);
            } catch {
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
      setTimeout(() => navigate('/chats'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (chat) {
        const updateField =
          chat.finder_id === user.id ? 'finder_unread_count' : 'claimant_unread_count';
        await supabase.from('chats').update({ [updateField]: 0 }).eq('id', chatId);
        
        // Trigger refetch of unread count to update Navbar badge
        refetchUnreadCount();
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // ─── Mark item as returned ───────────────────────────────
  const markAsReturned = async () => {
    try {
      setMarkingReturned(true);
      setShowReturnConfirm(false);

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      // Route through backend — service role key bypasses the RLS cascade
      // that causes "violates row-level security policy for user_profiles"
      const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${backendURL}/api/chats/${chatId}/return`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      toast.success('🎉 Item marked as returned! Great job helping someone out.');
      setChat(prev => ({ ...prev, is_closed: true, item: { ...prev.item, status: 'returned' } }));
    } catch (err) {
      console.error('Error marking returned:', err);
      toast.error('Failed to mark as returned: ' + err.message);
    } finally {
      setMarkingReturned(false);
    }
  };

  // ─── Send message ─────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || sending) return;

    if (text.length > 2000) {
      toast.error('Message is too long (max 2000 characters)');
      return;
    }
    if (!chat.enabled || chat.is_closed) {
      toast.error(chat.is_closed ? 'This chat has been closed' : 'This chat is disabled');
      return;
    }

    try {
      setSending(true);
      let messageToSend = text;

      if (encryptionEnabled && chatKey) {
        try {
          messageToSend = await encryptMessage(text, chatKey);
        } catch {
          console.error('Encryption failed, sending unencrypted');
        }
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          message_text: messageToSend,
        })
        .select(`
          *,
          sender:user_profiles!messages_sender_id_fkey(user_id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // ─── Loading state ────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          {/* Animated dots loader */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary-400 animate-typing-dot" style={{ animationDelay: '0s' }} />
            <div className="w-3 h-3 rounded-full bg-primary-400 animate-typing-dot" style={{ animationDelay: '0.2s' }} />
            <div className="w-3 h-3 rounded-full bg-primary-400 animate-typing-dot" style={{ animationDelay: '0.4s' }} />
          </div>
          <p className="caption font-medium tracking-wide">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────
  if (error || !chat) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 bg-surface">
        <div className="card p-8 flex flex-col items-center max-w-sm">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 bg-red-50">
            <AlertTriangle className="h-9 w-9 text-red-400" />
          </div>
          <h2 className="card-title mb-2">Something went wrong</h2>
          <p className="body-text text-sm mb-6 text-center">{error || 'This chat could not be found or you don\'t have access.'}</p>
          <button
            onClick={() => navigate('/chats')}
            className="btn btn-primary"
          >
            Back to Chats
          </button>
        </div>
      </div>
    );
  }

  const canSendMessages = chat.enabled && !chat.is_closed && !isBlockedByOther && !hasBlockedOther;
  const isFinder = chat.finder_id === user.id;
  const isAlreadyReturned = chat.item?.status === 'returned' || chat.is_closed;

  // ─── Main Layout: Header → Messages → Input ──────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      <ChatHeader
        chat={chat}
        otherParticipant={otherParticipant}
        chatId={chatId}
        onBlocked={() => navigate('/chats')}
        onUnblocked={() => setHasBlockedOther(false)}
        hasBlockedOther={hasBlockedOther}
        isFinder={isFinder}
        onMarkReturned={markAsReturned}
        markingReturned={markingReturned}
        isAlreadyReturned={isAlreadyReturned}
      />

      {/* Mark as Returned banner — visible to finder only, item not yet returned */}
      {isFinder && !isAlreadyReturned && (
        <div className="shrink-0 px-4 py-3 bg-green-50 border-b border-green-200">
          {!showReturnConfirm ? (
            /* Default state: info text + button */
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-900 leading-tight">Ready to hand it back?</p>
                  <p className="text-xs text-green-700 truncate">Click when you've returned the item to its owner</p>
                </div>
              </div>
              <button
                onClick={() => setShowReturnConfirm(true)}
                className="btn btn-success btn-sm flex-shrink-0 flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Returned
              </button>
            </div>
          ) : (
            /* Confirmation state */
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink leading-tight">Confirm item returned?</p>
                  <p className="caption">This will close the chat permanently and mark the item as returned.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-10 sm:ml-0">
                <button
                  onClick={() => setShowReturnConfirm(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={markAsReturned}
                  disabled={markingReturned}
                  className="btn btn-success btn-sm flex items-center gap-1.5 disabled:opacity-60"
                >
                  {markingReturned ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {markingReturned ? 'Saving...' : 'Yes, Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Returned confirmation banner — shown when chat is closed */}
      {isAlreadyReturned && chat.is_closed && (
        <div className="shrink-0 px-4 py-3 flex items-center gap-3 bg-green-50 border-b border-green-200">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-900">Item successfully returned to its owner 🎉</p>
            <p className="text-xs text-green-700">This chat is now closed. Thank you for making a difference!</p>
          </div>
        </div>
      )}

      <ChatContainer
        ref={messagesEndRef}
        messages={messages}
        userId={user.id}
        chat={chat}
      />

      <ChatInput
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        onSubmit={sendMessage}
        sending={sending}
        canSendMessages={canSendMessages}
        chat={chat}
        isBlockedByOther={isBlockedByOther}
        hasBlockedOther={hasBlockedOther}
      />
    </div>
  );
};

export default ChatPage;

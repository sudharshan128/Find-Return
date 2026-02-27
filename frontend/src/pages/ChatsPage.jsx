/**
 * Chats Page
 * List of user's active chats
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, getImageUrl } from '../lib/supabase';
import { MessageCircle, ChevronRight, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ChatsPage = () => {
  const { user, initializing } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Wait for auth to initialize
    if (initializing) {
      console.log('[CHATS] Waiting for auth to initialize...');
      return;
    }
    
    // Guard: no user
    if (!user?.id) {
      console.log('[CHATS] No user, setting loading to false');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchChats = async () => {
      try {
        console.log('[CHATS] Fetching chats for user:', user.id);
        setLoading(true);
        setError(null);

        const data = await db.chats.getForUser(user.id);
        if (!cancelled) {
          console.log('[CHATS] Chats fetched:', (data || []).length);
          setChats(data || []);
        }
      } catch (error) {
        console.error('[CHATS] Error fetching chats:', error);
        if (!cancelled) {
          setError(error.message || 'Failed to load chats');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchChats();
    return () => { cancelled = true; };
  }, [user?.id, initializing]);

  const getUnreadCount = (chat) => {
    const messages = chat.messages || [];
    return messages.filter(
      (m) => !m.is_read && m.sender_id !== user.id
    ).length;
  };

  const getLastMessage = (chat) => {
    const messages = chat.messages || [];
    return messages[messages.length - 1];
  };

  if (loading || initializing) {
    return (
    <div className="page-shell">
      <div className="container-app">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4">
                <div className="flex gap-4">
                  <div className="w-14 h-14 bg-surface-border rounded-lg" />
                  <div className="flex-1">
                    <div className="h-5 bg-surface-border rounded w-1/2 mb-2" />
                    <div className="h-4 bg-surface-border rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="container-app">
        <h1 className="page-title mb-2">Messages</h1>
        <p className="body-text mb-6">Chat with finders and claimants</p>

        {chats.length === 0 ? (
          <div className="card text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-muted rounded-full mb-4">
              <MessageCircle className="w-8 h-8 text-ink-subtle" />
            </div>
            <h3 className="card-title mb-1">No messages yet</h3>
            <p className="body-text mb-4">
              When a claim is approved, you can chat with the other party
            </p>
            <Link to="/" className="btn btn-primary">
              Browse Items
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {chats.map((chat) => {
              const unreadCount = getUnreadCount(chat);
              const lastMessage = getLastMessage(chat);
              const primaryImage = chat.item?.images?.find((i) => i.is_primary) || chat.item?.images?.[0];
              const isFinder = chat.finder_id === user.id;

              return (
                <Link
                  key={chat.id}
                  to={`/chats/${chat.id}`}
                  className="card p-4 flex gap-4 hover:shadow-card-hover transition-shadow"
                >
                  {/* Item Image */}
                  {primaryImage ? (
                    <img
                      src={getImageUrl(primaryImage)}
                      alt={chat.item?.title}
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-surface-muted rounded-lg flex-shrink-0 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-ink-subtle" />
                    </div>
                  )}

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-ink truncate">
                        {chat.item?.title || 'Item'}
                      </h3>
                      {lastMessage && (
                        <span className="caption flex-shrink-0">
                          {formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>

                    <p className="caption mt-0.5">
                      {isFinder ? 'You are the finder' : 'You are the claimant'}
                    </p>

                    {lastMessage && (
                      <p className="body-text text-sm mt-1 truncate">
                        {lastMessage.sender_id === user.id ? 'You: ' : ''}
                        {lastMessage.message_text || lastMessage.message}
                      </p>
                    )}
                  </div>

                  {/* Unread Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {unreadCount > 0 && (
                      <span className="flex items-center justify-center w-6 h-6 bg-primary-600 text-white text-xs font-medium rounded-full">
                        {unreadCount}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-ink-subtle" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsPage;

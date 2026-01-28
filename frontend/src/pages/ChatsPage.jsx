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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4">
                <div className="flex gap-4">
                  <div className="w-14 h-14 bg-gray-200 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-1/2 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Messages</h1>
        <p className="text-gray-600 mb-6">Chat with finders and claimants</p>

        {chats.length === 0 ? (
          <div className="card text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <MessageCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No messages yet</h3>
            <p className="text-gray-500 mb-4">
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
                    <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-gray-400" />
                    </div>
                  )}

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {chat.item?.title || 'Item'}
                      </h3>
                      {lastMessage && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 mt-0.5">
                      {isFinder ? 'You are the finder' : 'You are the claimant'}
                    </p>

                    {lastMessage && (
                      <p className="text-sm text-gray-600 mt-1 truncate">
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
                    <ChevronRight className="w-5 h-5 text-gray-400" />
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

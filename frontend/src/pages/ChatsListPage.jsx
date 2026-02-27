/**
 * Chats List Page - All user's conversations
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  MessageCircle, 
  Search,
  ChevronRight
} from 'lucide-react';

const ChatsListPage = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;

    loadChats();

    // Subscribe to chat updates
    const subscription = supabase
      .channel('chats-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
        },
        (payload) => {
          // Only reload if this user is a participant
          const chat = payload.new || payload.old;
          if (chat?.finder_id === user.id || chat?.claimant_id === user.id) {
            loadChats();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadChats(); // Reload when new messages arrive
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const loadChats = async () => {
    try {
      setLoading(true);

      // Query chats – use left joins (!) so we don't lose rows when related data is missing
      const { data, error } = await supabase
        .from('chats')
        .select(`
          id,
          item_id,
          claim_id,
          finder_id,
          claimant_id,
          last_message_at,
          is_closed,
          created_at,
          item:items!left(id, title, status),
          finder:user_profiles!chats_finder_id_fkey(user_id, full_name, avatar_url),
          claimant:user_profiles!chats_claimant_id_fkey(user_id, full_name, avatar_url)
        `)
        .or(`finder_id.eq.${user.id},claimant_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading chats:', error);
        // Only show error if it's not a "no rows" situation
        if (error.code !== 'PGRST116') {
          toast.error('Failed to load chats');
        }
        setChats([]);
        return;
      }

      // Enrich with participant info, filter out chats with missing item/participants
      const enrichedChats = (data || [])
        .filter((chat) => chat.item != null) // Skip chats whose item was deleted
        .map((chat) => ({
          ...chat,
          otherParticipant: (chat.finder_id === user.id ? chat.claimant : chat.finder) || { full_name: 'Unknown User', avatar_url: null, user_id: null },
          unreadCount:
            chat.finder_id === user.id
              ? (chat.finder_unread_count || 0)
              : (chat.claimant_unread_count || 0),
        }));

      setChats(enrichedChats);
    } catch (err) {
      console.error('Error loading chats:', err);
      // Don't show toast for empty results
      if (err?.message && !err.message.includes('0 rows')) {
        toast.error('Failed to load chats');
      }
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      (chat.item?.title || '').toLowerCase().includes(query) ||
      (chat.otherParticipant?.full_name || '').toLowerCase().includes(query)
    );
  });

  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);

  if (loading) {
    return (
      <div className="container-app py-16 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-surface-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="page-title">Messages</h1>
            {totalUnread > 0 && (
              <span className="badge badge-primary">
                {totalUnread} unread
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-ink-subtle" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      {/* Chats List */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {filteredChats.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-surface-muted rounded-full mb-4">
              <MessageCircle className="h-10 w-10 text-ink-subtle" />
            </div>
            <h3 className="card-title mb-2">
              {searchQuery ? 'No chats found' : 'No messages yet'}
            </h3>
            <p className="body-text">
              {searchQuery
                ? 'Try a different search term'
                : 'Your conversations will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChats.map((chat) => (
              <Link
                key={chat.id}
                to={`/chats/${chat.id}`}
                className="block bg-white rounded-xl border border-surface-border hover:shadow-card-hover transition-all p-4"
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  {chat.otherParticipant?.avatar_url ? (
                    <img
                      src={chat.otherParticipant.avatar_url}
                      alt={chat.otherParticipant?.full_name || 'User'}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                      {chat.otherParticipant?.full_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-ink truncate">
                        {chat.otherParticipant?.full_name || 'Unknown User'}
                      </h3>
                      {chat.last_message_at && (
                        <span className="caption ml-2 flex-shrink-0">
                          {formatLastMessageTime(chat.last_message_at)}
                        </span>
                      )}
                    </div>
                    
                    <p className="body-text truncate mb-1">
                      {chat.item?.title || 'Item'}
                    </p>

                    {/* Status badges */}
                    <div className="flex items-center space-x-2">
                      {chat.unreadCount > 0 && (
                        <span className="badge badge-primary">
                          {chat.unreadCount} new
                        </span>
                      )}
                      {chat.is_frozen && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          Frozen
                        </span>
                      )}
                      {chat.is_closed && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-full">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-ink-subtle flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsListPage;

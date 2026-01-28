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
  Loader2,
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

      // Query with all columns now that they exist
      const { data, error } = await supabase
        .from('chats')
        .select(`
          id,
          item_id,
          claim_id,
          finder_id,
          claimant_id,
          last_message_at,
          last_message_preview,
          finder_unread_count,
          claimant_unread_count,
          is_closed,
          enabled,
          created_at,
          item:items(id, title, status),
          finder:user_profiles!chats_finder_id_fkey(user_id, full_name, avatar_url),
          claimant:user_profiles!chats_claimant_id_fkey(user_id, full_name, avatar_url)
        `)
        .or(`finder_id.eq.${user.id},claimant_id.eq.${user.id}`)
        .eq('enabled', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })
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

      // Enrich with participant info
      const enrichedChats = (data || []).map((chat) => ({
        ...chat,
        otherParticipant: chat.finder_id === user.id ? chat.claimant : chat.finder,
        unreadCount:
          chat.finder_id === user.id
            ? chat.finder_unread_count
            : chat.claimant_unread_count,
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
      chat.item.title.toLowerCase().includes(query) ||
      chat.otherParticipant.full_name.toLowerCase().includes(query)
    );
  });

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            {totalUnread > 0 && (
              <span className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                {totalUnread} unread
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Chats List */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {filteredChats.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
              <MessageCircle className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No chats found' : 'No messages yet'}
            </h3>
            <p className="text-gray-500">
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
                className="block bg-white rounded-lg border border-gray-200 hover:shadow-md transition p-4"
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  {chat.otherParticipant.avatar_url ? (
                    <img
                      src={chat.otherParticipant.avatar_url}
                      alt={chat.otherParticipant.full_name}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                      {chat.otherParticipant.full_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {chat.otherParticipant.full_name}
                      </h3>
                      {chat.last_message_at && (
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {formatLastMessageTime(chat.last_message_at)}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate mb-1">
                      {chat.item.title}
                    </p>

                    {/* Status badges */}
                    <div className="flex items-center space-x-2">
                      {chat.unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
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
                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
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

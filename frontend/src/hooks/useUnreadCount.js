/**
 * useUnreadCount
 * Returns the total unread chat message count for the current user.
 *
 * Strategy:
 * - Fetches fresh from DB on mount and on route focus
 * - Increments immediately when a new message arrives (messages INSERT)
 * - Re-fetches (source of truth) whenever the chats table changes
 *   (covers the markRead → unread_count = 0 path)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useUnreadCount = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const knownChatsRef = useRef({}); // chatId → { isFinder, unread }

  const fetchCount = useCallback(async () => {
    if (!user?.id) { setUnreadCount(0); return; }

    try {
      console.log('[useUnreadCount] Fetching count from DB...');
      const { data, error } = await supabase
        .from('chats')
        .select('id, finder_id, claimant_id, finder_unread_count, claimant_unread_count')
        .or(`finder_id.eq.${user.id},claimant_id.eq.${user.id}`)
        .eq('is_closed', false)
        .eq('enabled', true);

      if (error) throw error;

      // Rebuild the per-chat map for fast increments later
      const map = {};
      let total = 0;
      (data || []).forEach((chat) => {
        const isFinder = chat.finder_id === user.id;
        const unread = isFinder ? (chat.finder_unread_count || 0) : (chat.claimant_unread_count || 0);
        map[chat.id] = { isFinder, unread };
        total += unread;
      });
      knownChatsRef.current = map;
      setUnreadCount(total);
      console.log('[useUnreadCount] Count updated:', total, 'from', data?.length || 0, 'chats');
    } catch (err) {
      console.error('[useUnreadCount] Error:', err);
    }
  }, [user?.id]);

  // Fetch on mount and whenever the route changes (catches chat-open navigation)
  useEffect(() => {
    fetchCount();
  }, [fetchCount, location.pathname]);

  // Real-time: listen to chats table (catches markRead zeroing the counter)
  // and messages table (catches new incoming messages for instant increment)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`unread-count-${user.id}`)
      // Chats table — any update to a row this user is in → re-fetch (covers markRead)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chats', filter: `finder_id=eq.${user.id}` },
        (payload) => {
          console.log('[useUnreadCount] Chats UPDATE (finder) detected:', payload);
          fetchCount();
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chats', filter: `claimant_id=eq.${user.id}` },
        (payload) => {
          console.log('[useUnreadCount] Chats UPDATE (claimant) detected:', payload);
          fetchCount();
        }
      )
      // Messages table — new message arrives → increment immediately if not sent by us
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('[useUnreadCount] Message INSERT detected:', payload);
          const msg = payload.new;
          if (!msg || msg.sender_id === user.id) return; // ignore own messages
          const chat = knownChatsRef.current[msg.chat_id];
          if (!chat) {
            // Unknown chat (newly created) — do a full re-fetch
            console.log('[useUnreadCount] Unknown chat, refetching...');
            fetchCount();
            return;
          }
          // Optimistic increment so the badge appears instantly
          console.log('[useUnreadCount] Incrementing count optimistically');
          setUnreadCount((prev) => prev + 1);
          knownChatsRef.current[msg.chat_id] = { ...chat, unread: chat.unread + 1 };
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchCount]);

  return { unreadCount, refetch: fetchCount };
};

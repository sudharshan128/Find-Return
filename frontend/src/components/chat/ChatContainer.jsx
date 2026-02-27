/**
 * ChatContainer - Premium scrollable message area with:
 * - Subtle doodle-pattern wallpaper
 * - Date group separators
 * - Scroll-to-bottom FAB
 * - Empty state with Lottie-like animation
 * - Typing indicator placeholder
 */

import { forwardRef, memo, useState, useCallback, useEffect, useRef } from 'react';
import { Send, AlertTriangle, Lock, ChevronDown, MessageCircle, ShieldCheck } from 'lucide-react';
import MessageBubble from './MessageBubble';

/**
 * Group messages by date for date separator rendering
 */
const groupMessagesByDate = (messages) => {
  const groups = [];
  let currentDate = null;

  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({ type: 'date', date: msg.created_at, id: `date-${msgDate}` });
    }
    groups.push({ type: 'message', data: msg, id: msg.id });
  });

  return groups;
};

const formatDateLabel = (timestamp) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

const ChatContainer = memo(forwardRef(({ messages, userId, chat }, ref) => {
  const scrollContainerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 200;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setShowScrollBtn(!isNearBottom);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const scrollToBottom = () => {
    ref?.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const grouped = groupMessagesByDate(messages);

  return (
    <div className="flex-1 overflow-hidden relative">
      {/* Wallpaper background — subtle doodle pattern */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto scroll-smooth"
        style={{ background: 'linear-gradient(180deg, #f0f4f8 0%, #f8fafc 30%, #f0f4f8 100%)' }}
      >
        <div className="w-full max-w-[900px] mx-auto px-2.5 sm:px-5 py-4 sm:py-5">
          {/* Status Banners */}
          {!chat?.enabled && !chat?.is_closed && (
            <div
              className="flex items-center gap-2.5 mb-4 px-4 py-3 rounded-xl text-center justify-center animate-slide-down"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.12) 100%)',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 font-medium">This chat has been disabled by an administrator</p>
            </div>
          )}

          {chat?.is_closed && (
            <div
              className="flex items-center gap-2.5 mb-4 px-4 py-3 rounded-xl text-center justify-center animate-slide-down"
              style={{
                background: 'linear-gradient(135deg, rgba(107,114,128,0.06) 0%, rgba(107,114,128,0.1) 100%)',
                border: '1px solid rgba(107,114,128,0.15)',
              }}
            >
              <Lock className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <p className="text-sm text-gray-700 font-medium">This chat has been closed</p>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[350px] py-20">
              <div className="animate-bounce-in">
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
                  style={{
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    boxShadow: '0 4px 20px rgba(59,130,246,0.12)',
                  }}
                >
                  <MessageCircle className="h-9 w-9 text-primary-400" />
                </div>
              </div>
              <p className="text-slate-500 font-semibold text-base">No messages yet</p>
              <p className="text-slate-400 text-sm mt-1.5 text-center max-w-[260px] leading-relaxed">
                Say hello and start the conversation about this item
              </p>
              <div className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-green-50 border border-green-100">
                <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                <span className="text-[11px] text-green-700 font-medium">Messages are private & secure</span>
              </div>
            </div>
          ) : (
            <>
              {/* Encryption notice at top */}
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-50/80 backdrop-blur border border-yellow-100/60">
                  <ShieldCheck className="h-3 w-3 text-yellow-600" />
                  <span className="text-[10.5px] text-yellow-700 font-medium">Messages are between you and the other participant</span>
                </div>
              </div>

              {/* Messages with date groups */}
              {grouped.map((item, idx) => {
                if (item.type === 'date') {
                  return (
                    <div key={item.id} className="flex items-center justify-center my-4">
                      <div
                        className="px-3.5 py-1 rounded-lg"
                        style={{
                          background: 'rgba(255,255,255,0.85)',
                          backdropFilter: 'blur(10px)',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                          border: '1px solid rgba(0,0,0,0.04)',
                        }}
                      >
                        <span className="text-[11px] text-gray-500 font-semibold tracking-wide uppercase">
                          {formatDateLabel(item.date)}
                        </span>
                      </div>
                    </div>
                  );
                }

                const message = item.data;
                const isMine = message.sender_id === userId;
                const prevItem = idx > 0 ? grouped[idx - 1] : null;
                const nextItem = idx < grouped.length - 1 ? grouped[idx + 1] : null;

                // Show avatar only for first message in a consecutive group from same sender
                const showAvatar = !isMine && (
                  !prevItem ||
                  prevItem.type === 'date' ||
                  prevItem.data?.sender_id !== message.sender_id
                );

                // Is last in group (next message is different sender, a date, or end of list)
                const isLastInGroup =
                  !nextItem ||
                  nextItem.type === 'date' ||
                  nextItem.data?.sender_id !== message.sender_id;

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isMine={isMine}
                    showAvatar={showAvatar}
                    isLastInGroup={isLastInGroup}
                  />
                );
              })}
            </>
          )}

          {/* Scroll anchor */}
          <div ref={ref} />
        </div>
      </div>

      {/* Scroll-to-bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 sm:right-6 w-10 h-10 rounded-full bg-white flex items-center justify-center animate-bounce-in z-10"
          style={{
            boxShadow: '0 2px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.04)',
          }}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5 text-gray-600" />
        </button>
      )}
    </div>
  );
}));

ChatContainer.displayName = 'ChatContainer';

export default ChatContainer;

/**
 * MessageBubble - Premium WhatsApp-style message bubble with tails, 
 * read receipts, hover reveal timestamps, and smooth entrance animations
 */

import { memo, useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatFullDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const MessageBubble = memo(({ message, isMine, showAvatar = true, isLastInGroup = false }) => {
  const sender = message.sender;
  const [showFullTime, setShowFullTime] = useState(false);

  if (isMine) {
    // ── Sent message (right-aligned) with tail ──
    return (
      <div
        className="flex justify-end mb-1 animate-message-sent group"
        style={{ marginBottom: isLastInGroup ? '12px' : '2px' }}
      >
        <div className="relative max-w-[82%] sm:max-w-[60%]">
          <div
            className="rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 cursor-default select-text"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 60%, #60a5fa 100%)',
              boxShadow: '0 1px 4px rgba(37,99,235,0.2), 0 2px 8px rgba(37,99,235,0.1)',
              borderBottomRightRadius: isLastInGroup ? '6px' : '18px',
            }}
            onClick={() => setShowFullTime(!showFullTime)}
          >
            <p className="text-white text-[13.5px] sm:text-sm break-words whitespace-pre-wrap leading-[1.55]">
              {message.message_text}
            </p>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <p className="text-[10.5px] leading-none" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {formatTime(message.created_at)}
              </p>
              {/* Read receipt */}
              {message.is_read ? (
                <CheckCheck className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.85)' }} />
              ) : (
                <Check className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
              )}
            </div>
          </div>

          {/* Hover full timestamp */}
          {showFullTime && (
            <div className="absolute -top-7 right-2 px-2 py-0.5 rounded-md text-[10px] text-gray-500 bg-white shadow-md border border-gray-100 whitespace-nowrap animate-fade-in z-10">
              {formatFullDate(message.created_at)}
            </div>
          )}

          {/* Tail for last message in group */}
          {isLastInGroup && (
            <div
              className="absolute -right-[6px] bottom-0 w-3 h-3"
              style={{
                background: '#3b82f6',
                clipPath: 'polygon(0 0, 0% 100%, 100% 100%)',
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Received message (left-aligned with avatar) ──
  return (
    <div
      className="flex items-end gap-1.5 sm:gap-2 animate-message-in group"
      style={{ marginBottom: isLastInGroup ? '12px' : '2px' }}
    >
      {/* Avatar — aligned to bottom, only first in group */}
      {showAvatar ? (
        sender?.avatar_url ? (
          <img
            src={sender.avatar_url}
            alt={sender.full_name}
            className="w-[28px] h-[28px] sm:w-[34px] sm:h-[34px] rounded-full object-cover flex-shrink-0"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
          />
        ) : (
          <div
            className="w-[28px] h-[28px] sm:w-[34px] sm:h-[34px] rounded-full flex items-center justify-center text-white font-semibold text-[11px] sm:text-xs flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            {sender?.full_name?.charAt(0).toUpperCase() || '?'}
          </div>
        )
      ) : (
        <div className="w-[28px] sm:w-[34px] flex-shrink-0" />
      )}

      {/* Bubble */}
      <div className="relative max-w-[82%] sm:max-w-[60%]">
        <div
          className="bg-white rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 cursor-default select-text"
          style={{
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.04)',
            borderBottomLeftRadius: isLastInGroup ? '6px' : '18px',
          }}
          onClick={() => setShowFullTime(!showFullTime)}
        >
          {/* Sender name for first message in group */}
          {showAvatar && sender?.full_name && (
            <p className="text-[11px] font-semibold text-primary-600 mb-0.5 leading-none">
              {sender.full_name}
            </p>
          )}
          <p className="text-gray-800 text-[13.5px] sm:text-sm break-words whitespace-pre-wrap leading-[1.55]">
            {message.message_text}
          </p>
          <p className="text-[10.5px] text-slate-400 mt-0.5 text-right leading-none">
            {formatTime(message.created_at)}
          </p>
        </div>

        {/* Hover full timestamp */}
        {showFullTime && (
          <div className="absolute -top-7 left-2 px-2 py-0.5 rounded-md text-[10px] text-gray-500 bg-white shadow-md border border-gray-100 whitespace-nowrap animate-fade-in z-10">
            {formatFullDate(message.created_at)}
          </div>
        )}

        {/* Tail for last message in group */}
        {isLastInGroup && (
          <div
            className="absolute -left-[6px] bottom-0 w-3 h-3"
            style={{
              background: '#ffffff',
              clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)',
            }}
          />
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;

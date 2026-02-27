/**
 * ChatInput - Premium message input with auto-expanding textarea,
 * smooth send animation, character counter, and keyboard shortcuts
 */

import { memo, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Lock, AlertTriangle, SmilePlus, Ban } from 'lucide-react';

const ChatInput = memo(({
  newMessage,
  setNewMessage,
  onSubmit,
  sending,
  canSendMessages,
  chat,
  isBlockedByOther = false,
  hasBlockedOther = false,
}) => {
  const textareaRef = useRef(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 120; // ~5 lines
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    autoResize();
  }, [newMessage, autoResize]);

  // Ctrl+Enter or Enter (without shift) to send
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() && !sending) {
        onSubmit(e);
      }
    }
  };

  if (!canSendMessages) {
    // Determine which blocked/disabled message to show
    const isBlockedState = isBlockedByOther || hasBlockedOther;
    const bgStyle = chat?.is_closed
      ? 'linear-gradient(135deg, rgba(107,114,128,0.06), rgba(107,114,128,0.1))'
      : isBlockedState
      ? 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(220,38,38,0.08))'
      : 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(245,158,11,0.1))';
    const borderColor = chat?.is_closed
      ? 'rgba(107,114,128,0.12)'
      : isBlockedState
      ? 'rgba(239,68,68,0.2)'
      : 'rgba(245,158,11,0.15)';

    return (
      <div
        className="shrink-0"
        style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="w-full max-w-[900px] mx-auto px-3 sm:px-4 py-3.5 sm:py-4">
          <div
            className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl"
            style={{ background: bgStyle, border: `1px solid ${borderColor}` }}
          >
            {chat?.is_closed ? (
              <>
                <Lock className="h-4.5 w-4.5 text-gray-400 flex-shrink-0" />
                <p className="text-gray-500 text-sm font-medium">This chat has been closed</p>
              </>
            ) : isBlockedByOther ? (
              <>
                <Ban className="h-4.5 w-4.5 text-red-400 flex-shrink-0" />
                <p className="text-red-500 text-sm font-medium">You can&apos;t send messages — this user has blocked you</p>
              </>
            ) : hasBlockedOther ? (
              <>
                <Ban className="h-4.5 w-4.5 text-red-400 flex-shrink-0" />
                <p className="text-red-500 text-sm font-medium">You have blocked this user — unblock to send messages</p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4.5 w-4.5 text-amber-400 flex-shrink-0" />
                <p className="text-gray-500 text-sm font-medium">This chat has been disabled</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hasContent = newMessage.trim().length > 0;

  return (
    <div
      className="shrink-0 relative z-10"
      style={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
      }}
    >
      <div className="w-full max-w-[900px] mx-auto px-2.5 sm:px-4">
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 sm:gap-2.5 py-2.5 sm:py-3"
        >
          {/* Emoji hint button (decorative) */}
          <button
            type="button"
            className="hidden sm:flex items-center justify-center h-11 w-11 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 flex-shrink-0 mb-0.5"
            title="Emoji"
          >
            <SmilePlus className="h-5 w-5" />
          </button>

          {/* Textarea */}
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={sending}
              maxLength={2000}
              rows={1}
              className="w-full resize-none border rounded-2xl px-4 py-2.5 sm:py-3 text-sm outline-none transition-all duration-200
                placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed leading-[1.5]"
              style={{
                borderColor: hasContent ? 'rgba(59,130,246,0.3)' : 'rgba(0,0,0,0.08)',
                background: hasContent ? 'rgba(239,246,255,0.4)' : 'rgba(248,250,252,0.8)',
                boxShadow: hasContent
                  ? '0 0 0 3px rgba(59,130,246,0.06), 0 1px 3px rgba(0,0,0,0.04)'
                  : '0 1px 3px rgba(0,0,0,0.04)',
                maxHeight: '120px',
                minHeight: '44px',
              }}
            />

            {/* Character counter — inside on desktop, below on mobile */}
            {newMessage.length > 100 && (
              <div className="absolute -top-5 right-1 sm:top-auto sm:-bottom-4 sm:right-2">
                <span className={`text-[10px] font-medium tabular-nums ${
                  newMessage.length > 1800
                    ? 'text-red-500'
                    : newMessage.length > 1500
                    ? 'text-amber-500'
                    : 'text-gray-400'
                }`}>
                  {newMessage.length}/2000
                </span>
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={!hasContent || sending}
            className="flex items-center justify-center flex-shrink-0 mb-0.5 transition-all duration-300"
            style={{
              width: hasContent ? (window.innerWidth >= 640 ? '90px' : '44px') : '44px',
              height: '44px',
              borderRadius: hasContent ? '14px' : '50%',
              background: hasContent
                ? 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)'
                : 'rgba(0,0,0,0.04)',
              boxShadow: hasContent
                ? '0 2px 8px rgba(37,99,235,0.3), 0 1px 3px rgba(37,99,235,0.15)'
                : 'none',
              color: hasContent ? 'white' : '#9ca3af',
              cursor: !hasContent || sending ? 'default' : 'pointer',
              transform: hasContent ? 'scale(1)' : 'scale(0.95)',
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-1.5">
                <Send className="h-[18px] w-[18px]" style={{ transform: 'rotate(-2deg)' }} />
                {hasContent && (
                  <span className="hidden sm:inline text-sm font-semibold">Send</span>
                )}
              </div>
            )}
          </button>
        </form>

        {/* Keyboard shortcut hint on desktop */}
        {hasContent && (
          <div className="hidden sm:flex justify-center pb-1.5 -mt-1">
            <span className="text-[10px] text-gray-400">
              Press <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[9px]">Enter</kbd> to send &middot; <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[9px]">Shift+Enter</kbd> for new line
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;

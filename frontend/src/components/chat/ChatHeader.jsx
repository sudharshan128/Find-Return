/**
 * ChatHeader - Glassmorphism header with online indicator, item preview, dropdown menu
 */

import { memo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Lock, Ban, Package, MoreVertical, CheckCircle2 } from 'lucide-react';
import BlockUserButton from '../BlockUserButton';

const ChatHeader = memo(({ chat, otherParticipant, chatId, onBlocked, onUnblocked, hasBlockedOther, isFinder, onMarkReturned, markingReturned, isAlreadyReturned }) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const itemImage = chat?.item?.item_images?.find(img => img.is_primary)?.image_url
    || chat?.item?.item_images?.[0]?.image_url;

  return (
    <div
      className="shrink-0 relative z-20"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div className="w-full max-w-[900px] mx-auto flex items-center justify-between h-[62px] sm:h-[72px] px-2 sm:px-4">
        {/* Left: Back + Avatar + Info */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate('/chats')}
            className="p-2 -ml-0.5 hover:bg-black/5 active:bg-black/10 rounded-xl transition-all duration-200 flex-shrink-0 group"
            aria-label="Back to chats"
          >
            <ChevronLeft className="h-5 w-5 text-gray-500 group-hover:text-gray-800 transition-colors" />
          </button>

          {otherParticipant && (
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {/* Avatar with online ring */}
              <div className="relative flex-shrink-0">
                {otherParticipant.avatar_url ? (
                  <img
                    src={otherParticipant.avatar_url}
                    alt={otherParticipant.full_name}
                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-white"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                  />
                ) : (
                  <div
                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base ring-2 ring-white"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
                      boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                    }}
                  >
                    {otherParticipant.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                {/* Online dot */}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-white"
                  style={{ background: '#22c55e' }}
                />
              </div>

              {/* Name + Item link */}
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 text-sm sm:text-[15px] truncate leading-tight">
                  {otherParticipant.full_name}
                </h2>
                {chat?.item && (
                  <Link
                    to={`/items/${chat.item.id}`}
                    className="flex items-center gap-1 text-xs sm:text-[13px] text-primary-600 hover:text-primary-700 truncate leading-tight mt-0.5 group/link"
                  >
                    <Package className="h-3 w-3 flex-shrink-0 opacity-60 group-hover/link:opacity-100 transition-opacity" />
                    <span className="truncate group-hover/link:underline">{chat.item.title}</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Status badges + Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-2">
          {/* Item thumbnail (desktop only) */}
          {itemImage && (
            <Link
              to={`/items/${chat?.item?.id}`}
              className="hidden md:block flex-shrink-0"
            >
              <img
                src={itemImage}
                alt=""
                className="w-9 h-9 rounded-lg object-cover ring-1 ring-black/5 hover:ring-primary-300 transition-all duration-200"
              />
            </Link>
          )}

          {/* Status badges */}
          {!chat?.enabled && !chat?.is_closed && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
            >
              <Lock className="h-3 w-3 text-red-500" />
              <span className="text-[11px] font-semibold text-red-600 tracking-wide uppercase">Disabled</span>
            </div>
          )}
          {chat?.is_closed && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.15)' }}
            >
              <Lock className="h-3 w-3 text-gray-500" />
              <span className="text-[11px] font-semibold text-gray-600 tracking-wide uppercase">Closed</span>
            </div>
          )}

          {/* Block button — Desktop */}
          {otherParticipant && (
            <div className="hidden sm:block">
              <BlockUserButton
                userId={otherParticipant.user_id}
                userName={otherParticipant.full_name}
                chatId={chatId}
                onBlocked={onBlocked}
                onUnblocked={onUnblocked}
                isBlocked={hasBlockedOther}
              />
            </div>
          )}

          {/* Mobile: 3-dot menu */}
          {otherParticipant && (
            <div className="sm:hidden relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-black/5 active:bg-black/10 rounded-xl transition-all"
              >
                <MoreVertical className="h-5 w-5 text-gray-500" />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div
                    className="absolute right-0 top-full mt-1 z-50 w-48 py-1.5 rounded-xl animate-slide-down"
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      backdropFilter: 'blur(20px)',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    {chat?.item && (
                      <Link
                        to={`/items/${chat.item.id}`}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-black/5 transition-colors"
                        onClick={() => setShowMenu(false)}
                      >
                        <Package className="h-4 w-4 text-gray-400" />
                        View Item
                      </Link>
                    )}
                    {isFinder && !isAlreadyReturned && (
                      <button
                        onClick={() => { onMarkReturned(); setShowMenu(false); }}
                        disabled={markingReturned}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors w-full disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Mark as Returned
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const btn = document.querySelector('[data-block-btn]');
                        if (btn) btn.click();
                        setShowMenu(false);
                      }}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors w-full ${hasBlockedOther ? 'text-gray-600 hover:bg-gray-50' : 'text-red-600 hover:bg-red-50'}`}
                    >
                      <Ban className="h-4 w-4" />
                      {hasBlockedOther ? 'Unblock User' : 'Block User'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;

/**
 * Navbar â€” Professional top navigation
 * Clean, classic, LinkedIn/Stripe-quality design
 */

import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import {
  Search,
  Plus,
  MessageCircle,
  User,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  Package,
  ChevronDown,
  FileSearch,
} from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, user, profile, isAdmin, signOut, initializing } = useAuth();

  // Fallback to auth metadata so name/email show immediately on refresh
  // even before the DB profile row is loaded.
  const displayName  = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const displayEmail = profile?.email || user?.email || '';
  const displayTrust = profile?.trust_score ?? null; // null = loading, not 50
  const { unreadCount } = useUnreadCount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close menus on route change
  useEffect(() => {
    setProfileOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    try {
      setProfileOpen(false);
      await signOut();
      setTimeout(() => navigate('/'), 100);
    } catch {
      setTimeout(() => navigate('/'), 100);
    }
  };

  const navLinks = [
    { to: '/',         label: 'Browse',        icon: Search },
    { to: '/report',   label: 'Report Found',  icon: Plus },
    { to: '/my-claims',label: 'My Claims',     icon: FileSearch },
  ];

  const avatarUrl = profile?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'U')}&background=1e3a8a&color=fff&bold=true`;

  return (
    <header className="bg-white border-b border-surface-border sticky top-0 z-50">
      <div className="container-app">
        <div className="flex items-center justify-between h-14">

          {/* â”€â”€ Logo â”€â”€ */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-primary-900 rounded-lg flex items-center justify-center shadow-sm">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[15px] text-ink tracking-tight">
              Find<span className="text-primary-600">&amp;</span>Return
            </span>
          </Link>

          {/* â”€â”€ Desktop nav links (authenticated only) â”€â”€ */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-0.5">
              {navLinks.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'text-primary-700 bg-primary-50'
                        : 'text-ink-muted hover:text-ink hover:bg-surface-muted'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          )}

          {/* â”€â”€ Right side â”€â”€ */}
          <div className="flex items-center gap-1.5">
            {isAuthenticated ? (
              <>
                {/* Messages */}
                <Link
                  to="/chats"
                  className="relative p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
                  title="Messages"
                >
                  <MessageCircle className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center
                                     bg-red-500 text-white text-[10px] font-bold rounded-full leading-none shadow">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Upload CTA */}
                <Link
                  to="/upload-item"
                  className="hidden sm:inline-flex btn btn-primary btn-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Post Item
                </Link>

                {/* Profile dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileOpen((v) => !v)}
                    className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-surface-muted transition-colors"
                    aria-expanded={profileOpen}
                  >
                    <img
                      src={avatarUrl}
                      alt={displayName || 'User'}
                      className="w-7 h-7 rounded-full object-cover ring-2 ring-surface-border"
                    />
                    <ChevronDown className={`w-3.5 h-3.5 text-ink-subtle transition-transform duration-150 ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-surface-border shadow-dropdown py-1 animate-slide-down">
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-surface-border">
                        <div className="flex items-center gap-3">
                          <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-surface-border" />
                          <div className="overflow-hidden">
                            <p className="text-sm font-semibold text-ink truncate">
                              {initializing && !displayName
                                ? <span className="inline-block w-24 h-3.5 bg-slate-200 rounded animate-pulse" />
                                : (displayName || 'User')}
                            </p>
                            <p className="text-xs text-ink-subtle truncate">{displayEmail}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <div className="h-1.5 flex-1 bg-surface-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${displayTrust !== null ? Math.min(displayTrust, 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-primary-600 tabular-nums">
                            {displayTrust !== null
                              ? displayTrust
                              : <span className="inline-block w-5 h-3 bg-slate-200 rounded animate-pulse" />}
                          </span>
                          <span className="caption">Trust</span>
                        </div>
                      </div>

                      {/* Menu items */}
                      <div className="py-1">
                        {[
                          { to: '/profile',    icon: User,          label: 'My Profile' },
                          { to: '/my-items',   icon: Package,       label: 'My Found Items' },
                          { to: '/my-claims',  icon: FileSearch,    label: 'My Claims' },
                          { to: '/settings',   icon: Settings,      label: 'Settings' },
                        ].map(({ to, icon: Icon, label }) => (
                          <Link
                            key={to}
                            to={to}
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            {label}
                          </Link>
                        ))}

                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors"
                          >
                            <Shield className="w-4 h-4 shrink-0" />
                            Admin Dashboard
                          </Link>
                        )}
                      </div>

                      <div className="border-t border-surface-border">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">
                Sign In
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-ink-muted hover:bg-surface-muted transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* â”€â”€ Mobile menu â”€â”€ */}
        {mobileOpen && (
          <div className="md:hidden border-t border-surface-border py-3 animate-slide-down">
            {isAuthenticated ? (
              <div className="space-y-0.5">
                {navLinks.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </NavLink>
                ))}
                <NavLink
                  to="/chats"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                    }`
                  }
                >
                  <span className="relative">
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center
                                       bg-red-500 text-white text-[9px] font-bold rounded-full leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </span>
                  Messages
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
                <Link
                  to="/upload-item"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 mt-2"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Post Found Item
                </Link>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="btn btn-primary w-full"
              >
                Sign In
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;

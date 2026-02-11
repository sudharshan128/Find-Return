/**
 * Admin Layout Component
 * Provides the main layout structure for the admin panel
 */

import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import { useSettings } from '../../hooks/useSettings';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  MessageSquare,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronDown,
  Bell,
  Search,
  History,
} from 'lucide-react';

const AdminLayout = () => {
  const { adminProfile, signOut, isSuperAdmin, isModerator } = useAdminAuth();
  const { platform_name } = useSettings();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const navigation = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      roles: ['analyst', 'moderator', 'super_admin'],
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: Users,
      roles: ['analyst', 'moderator', 'super_admin'],
    },
    {
      name: 'Items',
      href: '/admin/items',
      icon: Package,
      roles: ['analyst', 'moderator', 'super_admin'],
    },
    {
      name: 'Claims',
      href: '/admin/claims',
      icon: FileText,
      roles: ['analyst', 'moderator', 'super_admin'],
    },
    {
      name: 'Chats',
      href: '/admin/chats',
      icon: MessageSquare,
      roles: ['moderator', 'super_admin'],
    },
    {
      name: 'Abuse Reports',
      href: '/admin/reports',
      icon: AlertTriangle,
      roles: ['moderator', 'super_admin'],
      badge: true,
    },
    {
      name: 'Notifications',
      href: '/admin/notifications',
      icon: Bell,
      roles: ['analyst', 'moderator', 'super_admin'],
      badgeCount: unreadCount,
    },
    {
      name: 'Audit Logs',
      href: '/admin/audit-logs',
      icon: History,
      roles: ['super_admin'],
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      roles: ['super_admin'],
    },
  ];

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const data = await adminAPIClient.notifications.unreadCount();
        setUnreadCount(data.unread_count || 0);
      } catch (error) {
        // Silently fail - notifications table may not exist yet
        console.log('Notifications not available yet:', error.message);
      }
    };

    fetchUnreadCount();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(adminProfile?.role)
  );

  const isActive = (href) => {
    if (href === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(href);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'moderator':
        return 'bg-blue-100 text-blue-800';
      case 'analyst':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'moderator':
        return 'Moderator';
      case 'analyst':
        return 'Analyst';
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 bg-gray-800">
          <Link to="/admin" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-indigo-500" />
            <span className="text-white font-bold text-lg">Admin Panel</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-2 space-y-1">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.name}
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    !
                  </span>
                )}
                {item.badgeCount > 0 && (
                  <span className="ml-auto bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-medium">
                  {adminProfile?.full_name?.charAt(0) || adminProfile?.email?.charAt(0) || 'A'}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {adminProfile?.full_name || 'Admin'}
              </p>
              <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${getRoleBadgeColor(adminProfile?.role)}`}>
                {getRoleDisplayName(adminProfile?.role)}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`lg:pl-64 flex flex-col min-h-screen`}>
        {/* Top navbar */}
        <header className="sticky top-0 z-40 bg-white shadow-sm">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Search */}
            <div className="flex-1 max-w-lg mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users, items, claims..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <Link
                to="/admin/notifications"
                className="relative p-2 text-gray-500 hover:text-gray-700"
              >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
                >
                  <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {adminProfile?.full_name?.charAt(0) || 'A'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
                    <div className="px-4 py-2 border-b">
                      <p className="text-sm font-medium text-gray-900">
                        {adminProfile?.full_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {adminProfile?.email}
                      </p>
                    </div>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-white border-t py-4 px-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>{platform_name} - Admin Panel v1.0</p>
            <p>
              Logged in as <span className="font-medium">{adminProfile?.email}</span>
            </p>
          </div>
        </footer>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminLayout;

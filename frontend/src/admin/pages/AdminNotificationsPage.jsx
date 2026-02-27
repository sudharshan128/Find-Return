/**
 * Admin Notifications Page
 * Display and manage system notifications
 */

import { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import { supabase } from '../lib/adminSupabase';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
  AlertCircle,
  Info,
  UserPlus,
  UserCheck,
  UserX,
  Package,
  FileText,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
  Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';

const NotificationsPage = () => {
  const { adminProfile, isSuperAdmin } = useAdminAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all'); // all, unread
  const [typeFilter, setTypeFilter] = useState('all');
  const [stats, setStats] = useState(null);

  const fetchNotifications = async () => {
    try {
      console.log('[ADMIN NOTIFICATIONS] Fetching notifications...');
      setLoading(true);

      const data = await adminAPIClient.notifications.list({
        unread_only: filter === 'unread',
        type: typeFilter !== 'all' ? typeFilter : undefined,
      });

      console.log('[ADMIN NOTIFICATIONS] Fetched:', data);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('[ADMIN NOTIFICATIONS] Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await adminAPIClient.notifications.stats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await adminAPIClient.notifications.markRead(notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      toast.success('Marked as read');
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const result = await adminAPIClient.notifications.markAllRead();

      // Refresh notifications
      await fetchNotifications();
      await fetchStats();

      toast.success(result.message || 'All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    try {
      await adminAPIClient.notifications.delete(notificationId);

      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setTotal(prev => prev - 1);

      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const createTestNotification = async () => {
    try {
      await adminAPIClient.notifications.createTest({
        type: 'system_alert',
        title: 'Test Notification',
        message: 'This is a test notification created from the admin panel.',
        priority: 2,
      });

      toast.success('Test notification created');
      await fetchNotifications();
      await fetchStats();
    } catch (error) {
      console.error('Error creating test notification:', error);
      toast.error('Failed to create test notification');
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchStats();
  }, [filter, typeFilter]);

  // Real-time subscription for new notifications
  useEffect(() => {
    console.log('[ADMIN NOTIFICATIONS] Setting up real-time subscription...');
    
    const channel = supabase
      .channel('admin-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          console.log('[ADMIN NOTIFICATIONS] Real-time event:', payload);
          
          if (payload.eventType === 'INSERT') {
            console.log('[ADMIN NOTIFICATIONS] New notification received');
            // Refetch all notifications and stats
            fetchNotifications();
            fetchStats();
            toast.success('New notification received', { icon: '🔔' });
          } else if (payload.eventType === 'UPDATE') {
            // Update notification in local state
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new : n)
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove from local state
            setNotifications(prev =>
              prev.filter(n => n.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('[ADMIN NOTIFICATIONS] Subscription status:', status);
      });

    return () => {
      console.log('[ADMIN NOTIFICATIONS] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [filter, typeFilter]);

  // Auto-refresh every 8 seconds as backup for real-time
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
      fetchStats();
    }, 8000);

    return () => clearInterval(interval);
  }, [filter, typeFilter]);

  const getNotificationIcon = (type) => {
    const iconClass = "h-5 w-5";

    switch (type) {
      case 'user_registered':
        return <UserPlus className={`${iconClass} text-blue-600`} />;
      case 'membership_approved':
        return <UserCheck className={`${iconClass} text-green-600`} />;
      case 'membership_rejected':
        return <UserX className={`${iconClass} text-gray-600`} />;
      case 'item_reported':
        return <Package className={`${iconClass} text-purple-600`} />;
      case 'claim_submitted':
        return <FileText className={`${iconClass} text-orange-600`} />;
      case 'claim_approved':
        return <Check className={`${iconClass} text-green-600`} />;
      case 'claim_rejected':
        return <AlertCircle className={`${iconClass} text-red-600`} />;
      case 'abuse_report':
        return <AlertTriangle className={`${iconClass} text-red-600`} />;
      case 'user_banned':
        return <Ban className={`${iconClass} text-red-700`} />;
      case 'chat_flagged':
        return <MessageSquare className={`${iconClass} text-yellow-600`} />;
      case 'system_alert':
        return <ShieldAlert className={`${iconClass} text-indigo-600`} />;
      default:
        return <Info className={`${iconClass} text-gray-600`} />;
    }
  };

  const getNotificationColor = (type, priority) => {
    if (priority >= 4) return 'border-l-red-500 bg-red-50';
    if (priority === 3) return 'border-l-orange-500 bg-orange-50';

    switch (type) {
      case 'user_registered':
        return 'border-l-blue-500 bg-blue-50';
      case 'membership_approved':
      case 'claim_approved':
        return 'border-l-green-500 bg-green-50';
      case 'membership_rejected':
      case 'claim_rejected':
        return 'border-l-gray-400 bg-gray-50';
      case 'abuse_report':
      case 'user_banned':
        return 'border-l-red-500 bg-red-50';
      case 'item_reported':
        return 'border-l-purple-500 bg-purple-50';
      case 'claim_submitted':
        return 'border-l-orange-500 bg-orange-50';
      default:
        return 'border-l-indigo-500 bg-indigo-50';
    }
  };

  const getPriorityBadge = (priority) => {
    if (priority >= 4) {
      return <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">Urgent</span>;
    }
    if (priority === 3) {
      return <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">High</span>;
    }
    if (priority === 2) {
      return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Medium</span>;
    }
    return null;
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeLabel = (type) => {
    const labels = {
      user_registered: 'Registration',
      membership_approved: 'Approved',
      membership_rejected: 'Rejected',
      item_reported: 'Item',
      claim_submitted: 'Claim',
      claim_approved: 'Claim Approved',
      claim_rejected: 'Claim Rejected',
      abuse_report: 'Abuse Report',
      user_banned: 'Ban',
      chat_flagged: 'Chat',
      system_alert: 'System',
    };
    return labels[type] || type;
  };

  const renderNotificationDetails = (notification) => {
    const data = notification.data;
    if (!data || Object.keys(data).length === 0) return null;

    const details = [];
    
    // Show user/name info
    if (data.finder_name) details.push({ label: 'Posted by', value: data.finder_name });
    if (data.finder_email) details.push({ label: 'Email', value: data.finder_email });
    if (data.claimant_name) details.push({ label: 'Claimant', value: data.claimant_name });
    if (data.claimant_email) details.push({ label: 'Email', value: data.claimant_email });
    if (data.reporter_name) details.push({ label: 'Reporter', value: data.reporter_name });
    if (data.target_name) details.push({ label: 'Reported User', value: data.target_name });
    if (data.full_name) details.push({ label: 'User', value: data.full_name });
    if (data.email) details.push({ label: 'Email', value: data.email });

    // Show item info
    if (data.title) details.push({ label: 'Item', value: data.title });
    if (data.item_title) details.push({ label: 'Item', value: data.item_title });
    if (data.category) details.push({ label: 'Category', value: data.category });
    if (data.status) details.push({ label: 'Status', value: data.status });

    // Show report info
    if (data.reason) details.push({ label: 'Reason', value: data.reason });
    if (data.description) details.push({ label: 'Description', value: data.description });
    if (data.ban_reason) details.push({ label: 'Ban Reason', value: data.ban_reason });

    if (details.length === 0) return null;

    return (
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {details.map((detail, index) => (
            <div key={index} className="flex items-baseline gap-1.5 text-xs">
              <span className="text-gray-400 font-medium whitespace-nowrap">{detail.label}:</span>
              <span className="text-gray-700 truncate">{detail.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="mt-2 text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="h-7 w-7 text-indigo-600" />
              Notifications
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {unreadCount > 0 ? (
                <span className="font-medium text-indigo-600">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</span>
              ) : (
                'All caught up!'
              )}
              {total > 0 && <span className="text-gray-400 ml-2">({total} total)</span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <button
                onClick={createTestNotification}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
              >
                <Bell className="h-4 w-4" />
                Test
              </button>
            )}

            <button
              onClick={() => { fetchNotifications(); fetchStats(); }}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm"
              >
                <CheckCheck className="h-4 w-4" />
                Mark All Read
              </button>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="text-sm text-gray-500">Unread</div>
              <div className="text-2xl font-bold text-indigo-600">{stats.unread}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="text-sm text-gray-500">User Registrations</div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.by_type?.user_registered?.total || 0}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="text-sm text-gray-500">Abuse Reports</div>
              <div className="text-2xl font-bold text-red-600">
                {stats.by_type?.abuse_report?.unread || 0}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
        >
          <option value="all">All Notifications</option>
          <option value="unread">Unread Only</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
        >
          <option value="all">All Types</option>
          <option value="user_registered">User Registrations</option>
          <option value="membership_approved">Memberships Approved</option>
          <option value="membership_rejected">Memberships Rejected</option>
          <option value="item_reported">Items Reported</option>
          <option value="claim_submitted">Claims Submitted</option>
          <option value="claim_approved">Claims Approved</option>
          <option value="claim_rejected">Claims Rejected</option>
          <option value="abuse_report">Abuse Reports</option>
          <option value="user_banned">User Bans</option>
          <option value="system_alert">System Alerts</option>
        </select>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
            <p className="text-gray-500">
              {filter === 'unread' ? "You're all caught up! No unread notifications." : "There are no notifications yet."}
            </p>
            {isSuperAdmin && (
              <button
                onClick={createTestNotification}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                Create Test Notification
              </button>
            )}
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-lg border-l-4 p-4 transition-all hover:shadow-sm ${getNotificationColor(notification.type, notification.priority)} ${
                !notification.is_read ? 'shadow-sm ring-1 ring-gray-100' : 'opacity-80'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`flex-shrink-0 p-2 rounded-lg ${!notification.is_read ? 'bg-white shadow-sm' : 'bg-gray-50'}`}>
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className={`text-sm font-semibold ${!notification.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <span className="h-2 w-2 bg-indigo-600 rounded-full flex-shrink-0"></span>
                        )}
                        {getPriorityBadge(notification.priority)}
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                          {getTypeLabel(notification.type)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{notification.message}</p>
                      {renderNotificationDetails(notification)}
                      <p className="mt-1 text-xs text-gray-400">{formatTimeAgo(notification.created_at)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;

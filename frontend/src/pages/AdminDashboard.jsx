/**
 * Admin Dashboard
 * Manage items, users, and reports - Production Ready
 */

import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { db } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  LayoutDashboard,
  Package,
  Users,
  Flag,
  Shield,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  Eye,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { AdminStatsSkeleton, TableRowSkeleton } from '../components/common';

const AdminDashboard = () => {
  const location = useLocation();

  const navItems = [
    { path: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { path: '/admin/items', label: 'Items', icon: Package },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/reports', label: 'Reports', icon: Flag },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="card p-2 sticky top-24">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <Shield className="w-6 h-6 text-primary-600" />
              <span className="font-bold text-ink">Admin Panel</span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = item.end 
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-ink-muted hover:bg-surface-muted'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Routes>
            <Route index element={<AdminOverview />} />
            <Route path="items" element={<AdminItems />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="reports" element={<AdminReports />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

// Overview Page with Real Data
const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await db.admin.getStats();
      setStats(data);
      
      // Fetch recent audit logs
      const logs = await db.auditLogs.getRecent(5);
      setRecentActivity(logs);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="page-title mb-6">Dashboard Overview</h1>
        <AdminStatsSkeleton />
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Total Items', 
      value: stats?.items?.total || 0, 
      subLabel: `${stats?.items?.active || 0} active`,
      icon: Package, 
      color: 'text-blue-600 bg-blue-100' 
    },
    { 
      label: 'Items Returned', 
      value: stats?.items?.returned || 0, 
      subLabel: `${stats?.items?.claimed || 0} claimed`,
      icon: CheckCircle, 
      color: 'text-green-600 bg-green-100' 
    },
    { 
      label: 'Total Users', 
      value: stats?.users?.total || 0, 
      subLabel: `${stats?.users?.banned || 0} banned`,
      icon: Users, 
      color: 'text-purple-600 bg-purple-100' 
    },
    { 
      label: 'Pending Reports', 
      value: stats?.pendingReports || 0, 
      subLabel: `${stats?.pendingClaims || 0} pending claims`,
      icon: Flag, 
      color: 'text-red-600 bg-red-100',
      highlight: (stats?.pendingReports || 0) > 0
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Dashboard Overview</h1>
        <button 
          onClick={fetchStats}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <div key={i} className={`card ${stat.highlight ? 'ring-2 ring-red-200' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">{stat.value}</p>
                <p className="caption">{stat.label}</p>
                {stat.subLabel && (
                  <p className="text-xs text-ink-subtle">{stat.subLabel}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Flagged Items Alert */}
      {(stats?.items?.flagged || 0) > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            <span className="font-medium">{stats.items.flagged} items flagged</span> for review
          </p>
          <Link to="/admin/items?flagged=true" className="ml-auto text-sm text-yellow-700 underline">
            Review now
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="card-title mb-4">Recent Activity</h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-primary-600 rounded-full mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-ink truncate">
                      {activity.action} - {activity.entity_type}
                    </p>
                    <p className="caption">
                      {activity.user?.full_name || 'System'} • {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="body-text text-sm">No recent activity</p>
          )}
        </div>

        <div className="card">
          <h3 className="card-title mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link to="/admin/items?flagged=true" className="btn btn-secondary w-full justify-start">
              <AlertTriangle className="w-5 h-5 mr-3 text-yellow-600" />
              Review Flagged Items
              {(stats?.items?.flagged || 0) > 0 && (
                <span className="ml-auto badge badge-warning">{stats.items.flagged}</span>
              )}
            </Link>
            <Link to="/admin/reports" className="btn btn-secondary w-full justify-start">
              <Flag className="w-5 h-5 mr-3 text-red-600" />
              Handle Abuse Reports
              {(stats?.pendingReports || 0) > 0 && (
                <span className="ml-auto badge badge-danger">{stats.pendingReports}</span>
              )}
            </Link>
            <Link to="/admin/users?status=banned" className="btn btn-secondary w-full justify-start">
              <Ban className="w-5 h-5 mr-3 text-ink-muted" />
              Banned Users
              {(stats?.users?.banned || 0) > 0 && (
                <span className="ml-auto badge badge-secondary">{stats.users.banned}</span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// Items Management with Real Data
const AdminItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [flagDialog, setFlagDialog] = useState({ open: false, item: null });
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();
  const limit = 20;

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, count } = await db.admin.getAllItems({
        status: filter === 'all' ? null : filter,
        flagged: flaggedOnly || undefined,
        offset: page * limit,
        limit,
      });
      setItems(data || []);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [filter, flaggedOnly, page]);

  const handleFlag = async (reason) => {
    if (!flagDialog.item) return;
    setProcessing(true);
    try {
      await db.admin.flagItem(flagDialog.item.id, reason);
      toast.success('Item flagged');
      fetchItems();
    } catch (error) {
      toast.error('Failed to flag item');
    } finally {
      setProcessing(false);
      setFlagDialog({ open: false, item: null });
    }
  };

  const handleUnflag = async (itemId) => {
    try {
      await db.admin.unflagItem(itemId);
      toast.success('Item unflagged');
      fetchItems();
    } catch (error) {
      toast.error('Failed to unflag item');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="page-title mb-6">Items Management</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex gap-2">
          {['all', 'active', 'claimed', 'returned'].map((status) => (
            <button
              key={status}
              onClick={() => { setFilter(status); setPage(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-muted text-ink hover:bg-surface-border'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => { setFlaggedOnly(e.target.checked); setPage(0); }}
            className="rounded text-primary-600"
          />
          Flagged only
        </label>
        <span className="caption ml-auto">
          {total} item{total !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Items Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">Item</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">Finder</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {loading ? (
              [...Array(5)].map((_, i) => <TableRowSkeleton key={i} columns={5} />)
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center body-text">
                  No items found
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className={`hover:bg-surface-muted ${item.is_flagged ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.images?.[0] && (
                        <img 
                          src={item.images[0].image_url} 
                          alt="" 
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        <p className="caption">{item.category?.name}</p>
                      </div>
                      {item.is_flagged && (
                        <span className="badge badge-danger text-xs">Flagged</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 body-text text-sm">{item.finder?.full_name}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      item.status === 'active' ? 'badge-info' :
                      item.status === 'claimed' ? 'badge-warning' :
                      item.status === 'returned' ? 'badge-success' :
                      'badge-secondary'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 body-text text-sm">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => navigate(`/items/${item.id}`)}
                        className="p-1 hover:bg-surface-muted rounded"
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-ink-muted" />
                      </button>
                      {item.is_flagged ? (
                        <button 
                          onClick={() => handleUnflag(item.id)}
                          className="p-1 hover:bg-green-100 rounded"
                          title="Unflag"
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => setFlagDialog({ open: true, item })}
                          className="p-1 hover:bg-red-100 rounded"
                          title="Flag"
                        >
                          <Flag className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="body-text text-sm">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn btn-secondary btn-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Flag Dialog */}}
      <FlagItemDialog
        isOpen={flagDialog.open}
        item={flagDialog.item}
        onClose={() => setFlagDialog({ open: false, item: null })}
        onConfirm={handleFlag}
        loading={processing}
      />
    </div>
  );
};

// Flag Item Dialog
const FlagItemDialog = ({ isOpen, item, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="card w-full max-w-md p-6">
        <h3 className="card-title mb-4">
          Flag Item: {item?.title}
        </h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for flagging..."
          className="input w-full mb-4"
          rows={3}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(reason)} 
            className="flex-1 btn btn-danger"
            disabled={loading || !reason.trim()}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Flag Item'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Users Management with Real Data
const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [banDialog, setBanDialog] = useState({ open: false, user: null });
  const [processing, setProcessing] = useState(false);
  const limit = 20;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, count } = await db.admin.getAllUsers({
        status: filter === 'all' ? null : filter,
        offset: page * limit,
        limit,
      });
      setUsers(data || []);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filter, page]);

  const handleBan = async (reason) => {
    if (!banDialog.user) return;
    setProcessing(true);
    try {
      await db.admin.banUser(banDialog.user.user_id, reason);
      toast.success('User banned');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to ban user');
    } finally {
      setProcessing(false);
      setBanDialog({ open: false, user: null });
    }
  };

  const handleUnban = async (userId) => {
    try {
      await db.admin.unbanUser(userId);
      toast.success('User unbanned');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to unban user');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="page-title mb-6">Users Management</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['all', 'active', 'banned'].map((status) => (
          <button
            key={status}
            onClick={() => { setFilter(status); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-surface-muted text-ink hover:bg-surface-border'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
        <span className="caption ml-auto py-2">
          {total} user{total !== 1 ? 's' : ''} found
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">User</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">Trust Score</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">Role</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-ink">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {loading ? (
              [...Array(5)].map((_, i) => <TableRowSkeleton key={i} columns={5} />)
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center body-text">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.user_id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}&background=random`}
                        alt=""
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <p className="text-sm font-medium text-ink">{user.full_name || 'Unknown'}</p>
                        <p className="caption">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${
                      user.trust_score >= 70 ? 'text-green-600' :
                      user.trust_score >= 40 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {user.trust_score}/100
                    </span>
                  </td>
                  <td className="px-4 py-3 body-text text-sm capitalize">{user.role}</td>
                  <td className="px-4 py-3">
                    {user.account_status === 'banned' ? (
                      <span className="badge badge-danger">Banned</span>
                    ) : user.account_status === 'suspended' ? (
                      <span className="badge badge-warning">Suspended</span>
                    ) : (
                      <span className="badge badge-success">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {user.account_status === 'banned' ? (
                        <button 
                          onClick={() => handleUnban(user.user_id)}
                          className="p-1 hover:bg-green-100 rounded"
                          title="Unban"
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => setBanDialog({ open: true, user })}
                          className="p-1 hover:bg-red-100 rounded"
                          title="Ban"
                        >
                          <Ban className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="body-text text-sm">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn btn-secondary btn-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Ban Dialog */}
      <BanUserDialog
        isOpen={banDialog.open}
        user={banDialog.user}
        onClose={() => setBanDialog({ open: false, user: null })}
        onConfirm={handleBan}
        loading={processing}
      />
    </div>
  );
};

// Ban User Dialog
const BanUserDialog = ({ isOpen, user, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="card w-full max-w-md p-6">
        <h3 className="card-title mb-2">
          Ban User
        </h3>
        <p className="body-text text-sm mb-4">
          Are you sure you want to ban <strong>{user?.full_name || user?.email}</strong>?
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for ban (required)..."
          className="input w-full mb-4"
          rows={3}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(reason)} 
            className="flex-1 btn btn-danger"
            disabled={loading || !reason.trim()}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ban User'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Reports Management with Real Data
const AdminReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await db.reports.getAll(filter === 'all' ? null : filter);
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const handleResolve = async (reportId) => {
    setProcessing(reportId);
    try {
      await db.reports.updateStatus(reportId, 'resolved', 'Issue resolved by admin', 'action_taken');
      toast.success('Report resolved');
      fetchReports();
    } catch (error) {
      toast.error('Failed to update report');
    } finally {
      setProcessing(null);
    }
  };

  const handleDismiss = async (reportId) => {
    setProcessing(reportId);
    try {
      await db.reports.updateStatus(reportId, 'dismissed', 'Report dismissed - no violation found', 'dismissed');
      toast.success('Report dismissed');
      fetchReports();
    } catch (error) {
      toast.error('Failed to update report');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div>
      <h1 className="page-title mb-6">Abuse Reports</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['pending', 'reviewing', 'resolved', 'dismissed', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-surface-muted text-ink hover:bg-surface-border'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-surface-border rounded w-1/4 mb-3" />
              <div className="h-4 bg-surface-border rounded w-full mb-2" />
              <div className="h-4 bg-surface-border rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="card-title mb-1">No reports</h3>
          <p className="body-text">
            {filter === 'pending' ? 'All caught up! No pending reports.' : 'No reports in this category.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`badge ${
                    report.status === 'pending' ? 'badge-warning' : 
                    report.status === 'reviewing' ? 'badge-info' :
                    report.status === 'resolved' ? 'badge-success' : 
                    'badge-secondary'
                  }`}>
                    {report.status}
                  </span>
                  <span className="badge badge-secondary">{report.reason}</span>
                </div>
                <p className="caption">
                  {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                </p>
              </div>
              
              <p className="text-ink mb-3">{report.description}</p>
              
              <div className="caption mb-4">
                Reported by: {report.reporter?.full_name || 'Unknown'}
                {report.target_item && (
                  <span className="ml-2">
                    • Item: <Link to={`/items/${report.target_item.id}`} className="text-primary-600 hover:underline">
                      {report.target_item.title}
                    </Link>
                  </span>
                )}
                {report.target_user && (
                  <span className="ml-2">• User: {report.target_user.full_name}</span>
                )}
              </div>

              {report.status === 'pending' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleResolve(report.id)}
                    disabled={processing === report.id}
                    className="btn btn-success btn-sm"
                  >
                    {processing === report.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Resolve
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => handleDismiss(report.id)}
                    disabled={processing === report.id}
                    className="btn btn-secondary btn-sm"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Dismiss
                  </button>
                </div>
              )}

              {report.admin_notes && (
                <div className="mt-3 p-3 bg-surface-muted rounded-lg">
                  <p className="caption mb-1">Admin Notes:</p>
                  <p className="body-text text-sm">{report.admin_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
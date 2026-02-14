/**
 * Admin Dashboard Page
 * Main dashboard with real-time statistics and charts
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import {
  Users,
  Package,
  FileText,
  AlertTriangle,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Shield,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminDashboardPage = () => {
  const { adminProfile, isSuperAdmin, isAuthenticated, loading: authLoading } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [areaStats, setAreaStats] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      setError(null);

      console.log('[ADMIN DASHBOARD] Fetching data via backend...');
      // ✓ CRITICAL FIX: Call backend API instead of Supabase directly
      const [summary, daily, areas, categories] = await Promise.all([
        adminAPIClient.analytics.summary(),
        adminAPIClient.analytics.trends(14),
        adminAPIClient.analytics.areas(),
        adminAPIClient.analytics.categories(),
      ]);

      console.log('[ADMIN DASHBOARD] Data fetched successfully');
      setStats(summary || {});
      setDailyStats(daily || []);
      setAreaStats((areas || []).slice(0, 10));
      setCategoryStats(categories || []);
      setError(null);

      if (isRefresh) toast.success('Dashboard refreshed');
    } catch (error) {
      console.error('[ADMIN DASHBOARD] Error fetching data:', error);
      // FIX: Set safe empty states when data fetch fails
      // Show "No data" instead of white screen
      setStats({
        totalItems: 0,
        totalClaims: 0,
        totalReports: 0,
        totalUsers: 0,
        activeItems: 0,
        approvedClaims: 0,
      });
      setDailyStats([]);
      setAreaStats([]);
      setCategoryStats([]);
      setError(error?.message || 'Failed to load dashboard data');
      // Don't show toast here - data loads but shows empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Only fetch when auth is complete AND adminProfile is set
  useEffect(() => {
    // CRITICAL: Wait for auth to be fully initialized
    if (authLoading) {
      console.log('[ADMIN DASHBOARD] Waiting for auth to initialize...');
      return;
    }

    if (!isAuthenticated) {
      console.log('[ADMIN DASHBOARD] Not authenticated');
      setLoading(false);
      return;
    }

    if (!adminProfile?.id) {
      console.log('[ADMIN DASHBOARD] Admin profile not loaded yet');
      setLoading(true);
      return;
    }

    console.log('[ADMIN DASHBOARD] Auth ready, fetching data...');
    fetchData();
  }, [authLoading, isAuthenticated, adminProfile?.id]);

  // Safety fallback: if auth is not loading but data is still loading after 5 seconds
  useEffect(() => {
    if (!authLoading && loading) {
      const timeout = setTimeout(() => {
        console.warn('[ADMIN DASHBOARD] Loading timeout - forcing completion');
        setLoading(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [authLoading, loading]);

  const StatCard = ({ title, value, icon: Icon, color, subValue, subLabel, trend, link }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value?.toLocaleString() || 0}</p>
          {subValue !== undefined && (
            <p className="text-sm text-gray-500 mt-1">
              {subLabel}: <span className="font-medium">{subValue}</span>
            </p>
          )}
          {trend !== undefined && (
            <div className={`flex items-center mt-2 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
              {Math.abs(trend)}% from yesterday
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      {link && (
        <Link
          to={link}
          className="mt-4 flex items-center text-sm text-indigo-600 hover:text-indigo-800"
        >
          View all <ArrowRight className="h-4 w-4 ml-1" />
        </Link>
      )}
    </div>
  );

  const AlertCard = ({ title, count, type, link }) => {
    const colors = {
      danger: 'bg-red-50 border-red-200 text-red-800',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    return (
      <Link
        to={link}
        className={`block p-4 rounded-lg border ${colors[type]} hover:shadow-md transition-shadow`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{count}</p>
          </div>
          <AlertTriangle className="h-8 w-8 opacity-50" />
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-800">Dashboard Error</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <button
              onClick={() => fetchData(true)}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            Welcome back, {adminProfile?.full_name || 'Admin'}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alert cards for items needing attention */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AlertCard
          title="Pending Abuse Reports"
          count={stats?.reports?.pending || 0}
          type="danger"
          link="/admin/reports?status=pending"
        />
        <AlertCard
          title="Flagged Items"
          count={stats?.items?.flagged || 0}
          type="warning"
          link="/admin/items?flagged=true"
        />
        <AlertCard
          title="Low Trust Users"
          count={stats?.users?.low_trust || 0}
          type="info"
          link="/admin/users?trust=low"
        />
      </div>

      {/* User Growth Overview */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">User Registration Trends</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Total Users</p>
            <p className="text-3xl font-bold text-blue-600">{stats?.users?.total || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Joined Today</p>
            <p className="text-3xl font-bold text-green-600">{stats?.users?.new_today || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleDateString()}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">This Week</p>
            <p className="text-3xl font-bold text-indigo-600">{stats?.users?.new_this_week || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">This Month</p>
            <p className="text-3xl font-bold text-purple-600">{stats?.users?.new_this_month || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { month: 'long' })}</p>
          </div>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats?.users?.total}
          icon={Users}
          color="bg-blue-500"
          subValue={`${stats?.users?.new_today || 0} today, ${stats?.users?.new_this_week || 0} this week`}
          subLabel="New users"
          link="/admin/users"
        />
        <StatCard
          title="Active Items"
          value={stats?.items?.active}
          icon={Package}
          color="bg-green-500"
          subValue={stats?.items?.returned}
          subLabel="Returned"
          link="/admin/items"
        />
        <StatCard
          title="Active Chats"
          value={stats?.chats?.active}
          icon={MessageSquare}
          color="bg-purple-500"
          subValue={stats?.chats?.frozen}
          subLabel="Frozen"
          link="/admin/chats"
        />
        <StatCard
          title="Total Claims"
          value={stats?.claims?.total}
          icon={FileText}
          color="bg-gray-500"
          subValue={`${stats?.claims?.pending || 0} pending`}
          subLabel={`${stats?.claims?.approved || 0} approved, ${stats?.claims?.rejected || 0} rejected`}
          link="/admin/claims"
        />
      </div>

      {/* Claims breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Pending Claims"
          value={stats?.claims?.pending}
          icon={Clock}
          color="bg-yellow-500"
          subValue={stats?.claims?.total}
          subLabel="Total claims"
          link="/admin/claims?status=pending"
        />
        <StatCard
          title="Approved Claims"
          value={stats?.claims?.approved}
          icon={CheckCircle}
          color="bg-green-500"
          subValue={stats?.claims?.approved_today}
          subLabel="Approved today"
          link="/admin/claims?status=approved"
        />
        <StatCard
          title="Rejected Claims"
          value={stats?.claims?.rejected}
          icon={XCircle}
          color="bg-red-500"
          link="/admin/claims?status=rejected"
        />
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/admin/reports?status=pending"
            className="flex flex-col items-center p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="h-8 w-8 text-red-600 mb-2" />
            <span className="text-sm font-medium text-red-800">Review Reports</span>
          </Link>
          <Link
            to="/admin/items?flagged=true"
            className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <Eye className="h-8 w-8 text-yellow-600 mb-2" />
            <span className="text-sm font-medium text-yellow-800">Review Flagged</span>
          </Link>
          <Link
            to="/admin/users?status=suspended"
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Users className="h-8 w-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-800">Suspended Users</span>
          </Link>
          {isSuperAdmin() && (
            <Link
              to="/admin/audit-logs"
              className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <Shield className="h-8 w-8 text-purple-600 mb-2" />
              <span className="text-sm font-medium text-purple-800">Audit Logs</span>
            </Link>
          )}
        </div>
      </div>

      {/* Charts and detailed stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Area statistics */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Items by Area (Top 10)</h2>
          <div className="space-y-3">
            {areaStats.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No data available</p>
            ) : (
              areaStats.map((area, index) => (
                <div key={area.name} className="flex items-center">
                  <span className="w-8 text-sm text-gray-500">{index + 1}.</span>
                  <span className="flex-1 text-sm font-medium text-gray-700">{area.name}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">{area.total} items</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${(area.active / (area.total || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category statistics */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Items by Category</h2>
          <div className="space-y-3">
            {categoryStats.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No data available</p>
            ) : (
              categoryStats.map((category) => (
                <div key={category.name} className="flex items-center">
                  <span className="w-8 text-lg">{category.icon}</span>
                  <span className="flex-1 text-sm font-medium text-gray-700">{category.name}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">{category.total}</span>
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center text-xs text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {category.returned}
                      </span>
                      <span className="flex items-center text-xs text-blue-600">
                        <Clock className="h-3 w-3 mr-1" />
                        {category.active}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent activity / daily trend */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity (Last 14 Days)</h2>
        {dailyStats.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No historical data available yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Users</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Items</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claims</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Returned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dailyStats.map((day) => (
                  <tr key={day.stat_date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(day.stat_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{day.new_users || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{day.new_items || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{day.new_claims || 0}</td>
                    <td className="px-4 py-3 text-sm text-green-600">{day.returned_items || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{day.new_reports || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* System status */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Database</p>
              <p className="text-xs text-gray-500">Operational</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Authentication</p>
              <p className="text-xs text-gray-500">Operational</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Storage</p>
              <p className="text-xs text-gray-500">Operational</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Real-time</p>
              <p className="text-xs text-gray-500">Connected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;

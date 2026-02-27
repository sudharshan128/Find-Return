/**
 * Admin Users Page
 * Complete user management with moderation actions
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  AlertTriangle,
  Ban,
  MessageSquareOff,
  Lock,
  Eye,
  MoreVertical,
  X,
  RefreshCw,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminUsersPage = () => {
  const { adminProfile, isSuperAdmin, isModerator, loading: authLoading } = useAdminAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [trustFilter, setTrustFilter] = useState(searchParams.get('trust') || '');
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    // Guard: only fetch if auth is ready
    if (authLoading || !adminProfile?.id) {
      console.log('[ADMIN USERS] Auth not ready, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('[ADMIN USERS] Fetching users...');
      setLoading(true);
      setError(null);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        status: statusFilter || undefined,
      };

      const result = await adminAPIClient.users.getAll(params);
      
      // Apply trust filter client-side
      let filteredData = result.data || [];
      if (trustFilter === 'low') {
        filteredData = filteredData.filter(u => u.trust_score < 40);
      } else if (trustFilter === 'high') {
        filteredData = filteredData.filter(u => u.trust_score >= 80);
      }

      setUsers(filteredData);
      setPagination(prev => ({ ...prev, total: result.total }));
      console.log('[ADMIN USERS] Users fetched:', filteredData.length);
    } catch (error) {
      console.error('[ADMIN USERS] Error fetching users:', error);
      setError(error.message || 'Failed to load users');
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, trustFilter, authLoading, adminProfile?.id]);

  useEffect(() => {
    if (!authLoading && adminProfile?.id) {
      fetchUsers();
    } else if (authLoading) {
      console.log('[ADMIN USERS] Waiting for auth to load...');
    }
  }, [fetchUsers, authLoading, adminProfile?.id]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams({ search, status: statusFilter, trust: trustFilter });
  };

  const openUserDetail = async (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const openActionModal = (user, action) => {
    setSelectedUser(user);
    setActionType(action);
    setShowActionModal(true);
  };

  const handleAction = async (formData) => {
    try {
      setActionLoading(true);
      
      switch (actionType) {
        case 'warn':
          await adminAPIClient.users.warn(selectedUser.user_id, {
            type: formData.warningType,
            severity: formData.severity,
            title: formData.title,
            description: formData.description,
          });
          toast.success('Warning issued successfully');
          break;
          
        case 'suspend':
          await adminAPIClient.users.suspend(selectedUser.user_id, {
            reason: formData.reason,
            duration: formData.duration || null,
          });
          toast.success('User suspended successfully');
          break;
          
        case 'ban':
          // Require explicit confirmation
          if (formData.confirmBan !== 'BAN') {
            toast.error('Please type "BAN" to confirm this action');
            setActionLoading(false);
            return;
          }
          await adminAPIClient.users.ban(selectedUser.user_id, formData.reason);
          toast.success('User banned successfully');
          break;
          
        case 'unban':
          await adminAPIClient.users.unban(selectedUser.user_id);
          toast.success('User unbanned successfully');
          break;
          
        case 'adjust_trust':
          await adminAPIClient.users.adjustTrustScore(
            selectedUser.user_id,
            formData.newScore,
            formData.reason
          );
          toast.success('Trust score adjusted successfully');
          break;
          
        case 'disable_chat':
          await adminAPIClient.users.disableChat(selectedUser.user_id, formData.reason);
          toast.success('Chat disabled for user');
          break;
          
        case 'enable_chat':
          await adminAPIClient.users.enableChat(selectedUser.user_id);
          toast.success('Chat enabled for user');
          break;
          
        case 'block_claims':
          await adminAPIClient.users.blockClaims(selectedUser.user_id, formData.reason);
          toast.success('Claims blocked for user');
          break;
          
        case 'unblock_claims':
          await adminAPIClient.users.unblockClaims(selectedUser.user_id);
          toast.success('Claims unblocked for user');
          break;
          
        default:
          break;
      }
      
      setShowActionModal(false);
      fetchUsers();
    } catch (error) {
      console.error('Action error:', error);
      toast.error(`Failed to ${actionType}: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getTrustScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      banned: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">Manage and moderate platform users</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>

          <select
            value={trustFilter}
            onChange={(e) => setTrustFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Trust Scores</option>
            <option value="high">High (80+)</option>
            <option value="low">Low (&lt;40)</option>
          </select>

          <button
            type="submit"
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trust Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Restrictions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          {user.avatar_url ? (
                            <img
                              className="h-10 w-10 rounded-full"
                              src={user.avatar_url}
                              alt=""
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.full_name || 'No name'}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTrustScoreColor(user.trust_score)}`}>
                        {user.trust_score}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(user.account_status)}`}>
                        {user.account_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>Items: {user.items_found_count}</div>
                      <div>Claims: {user.claims_made_count}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {user.is_chat_disabled && (
                          <span className="text-red-500" title="Chat disabled">
                            <MessageSquareOff className="h-4 w-4" />
                          </span>
                        )}
                        {user.is_claim_blocked && (
                          <span className="text-yellow-500" title="Claims blocked">
                            <Lock className="h-4 w-4" />
                          </span>
                        )}
                        {user.active_warnings_count > 0 && (
                          <span className="text-orange-500" title={`${user.active_warnings_count} warnings`}>
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                        )}
                        {!user.is_chat_disabled && !user.is_claim_blocked && user.active_warnings_count === 0 && (
                          <span className="text-green-500">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openUserDetail(user)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="View details"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        {isModerator() && (
                          <div className="relative group">
                            <button className="text-gray-500 hover:text-gray-700">
                              <MoreVertical className="h-5 w-5" />
                            </button>
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-10 hidden group-hover:block">
                              <button
                                onClick={() => openActionModal(user, 'warn')}
                                className="w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50"
                              >
                                Issue Warning
                              </button>
                              <button
                                onClick={() => openActionModal(user, 'adjust_trust')}
                                className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                              >
                                Adjust Trust Score
                              </button>
                              {user.is_chat_disabled ? (
                                <button
                                  onClick={() => openActionModal(user, 'enable_chat')}
                                  className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                                >
                                  Enable Chat
                                </button>
                              ) : (
                                <button
                                  onClick={() => openActionModal(user, 'disable_chat')}
                                  className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                                >
                                  Disable Chat
                                </button>
                              )}
                              {user.is_claim_blocked ? (
                                <button
                                  onClick={() => openActionModal(user, 'unblock_claims')}
                                  className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                                >
                                  Unblock Claims
                                </button>
                              ) : (
                                <button
                                  onClick={() => openActionModal(user, 'block_claims')}
                                  className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                                >
                                  Block Claims
                                </button>
                              )}
                              {user.account_status !== 'banned' && (
                                <button
                                  onClick={() => openActionModal(user, 'suspend')}
                                  className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                                >
                                  Suspend Account
                                </button>
                              )}
                              {isSuperAdmin() && user.account_status !== 'banned' && (
                                <button
                                  onClick={() => openActionModal(user, 'ban')}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  Ban Account
                                </button>
                              )}
                              {user.account_status === 'banned' && isSuperAdmin() && (
                                <button
                                  onClick={() => openActionModal(user, 'unban')}
                                  className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                                >
                                  Unban Account
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>
                  {' '}-{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
                </span>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page * pagination.limit >= pagination.total}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
      />

      {/* Action Modal */}
      <ActionModal
        user={selectedUser}
        actionType={actionType}
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        onSubmit={handleAction}
        loading={actionLoading}
      />
    </div>
  );
};

// User Detail Modal Component
const UserDetailModal = ({ user, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [trustHistory, setTrustHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserDetails();
    }
  }, [isOpen, user]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const [userItems, userClaims, userWarnings, history] = await Promise.all([
        adminAPIClient.users.getUserItems(user.user_id),
        adminAPIClient.users.getUserClaims(user.user_id),
        adminAPIClient.users.getUserWarnings(user.user_id),
        adminAPIClient.users.getTrustHistory(user.user_id),
      ]);
      setItems(userItems);
      setClaims(userClaims);
      setWarnings(userWarnings);
      setTrustHistory(history);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
    setLoading(false);
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-4">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-16 w-16 rounded-full" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-500" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.full_name || 'No name'}</h2>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            {['overview', 'items', 'claims', 'warnings', 'trust_history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 border-b-2 text-sm font-medium ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.replace('_', ' ').charAt(0).toUpperCase() + tab.replace('_', ' ').slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-4">Account Information</h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm text-gray-500">User ID</dt>
                        <dd className="text-sm font-mono text-gray-900">{user.user_id}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Status</dt>
                        <dd className="text-sm font-medium text-gray-900 capitalize">{user.account_status}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Trust Score</dt>
                        <dd className="text-sm font-medium text-gray-900">{user.trust_score}/100</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Joined</dt>
                        <dd className="text-sm text-gray-900">{new Date(user.created_at).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Last Active</dt>
                        <dd className="text-sm text-gray-900">{new Date(user.last_active_at).toLocaleString()}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-4">Statistics</h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Items Found</dt>
                        <dd className="text-sm font-medium text-gray-900">{user.items_found_count}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Items Returned</dt>
                        <dd className="text-sm font-medium text-gray-900">{user.items_returned_count}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Claims Made</dt>
                        <dd className="text-sm font-medium text-gray-900">{user.claims_made_count}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Successful Claims</dt>
                        <dd className="text-sm font-medium text-gray-900">{user.successful_claims_count}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Reports Received</dt>
                        <dd className="text-sm font-medium text-gray-900">{user.reports_received_count}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {activeTab === 'items' && (
                <div className="space-y-4">
                  {items.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No items found</p>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{item.title}</h4>
                            <p className="text-sm text-gray-500">
                              {item.categories?.name} • {item.areas?.name}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            item.status === 'active' ? 'bg-green-100 text-green-800' :
                            item.status === 'returned' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'claims' && (
                <div className="space-y-4">
                  {claims.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No claims found</p>
                  ) : (
                    claims.map((claim) => (
                      <div key={claim.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{claim.items?.title || 'Unknown Item'}</h4>
                            <p className="text-sm text-gray-500">
                              {new Date(claim.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            claim.status === 'approved' ? 'bg-green-100 text-green-800' :
                            claim.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {claim.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'warnings' && (
                <div className="space-y-4">
                  {warnings.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No warnings</p>
                  ) : (
                    warnings.map((warning) => (
                      <div key={warning.id} className={`border rounded-lg p-4 ${
                        warning.severity === 'high' ? 'border-red-200 bg-red-50' :
                        warning.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                        'border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{warning.title}</h4>
                          <span className="text-xs text-gray-500">
                            {new Date(warning.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{warning.description}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'trust_history' && (
                <div className="space-y-4">
                  {trustHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No trust score history</p>
                  ) : (
                    trustHistory.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between border-b pb-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {entry.old_score} → {entry.new_score}
                            <span className={`ml-2 ${entry.change_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ({entry.change_amount >= 0 ? '+' : ''}{entry.change_amount})
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">{entry.change_reason}</p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Action Modal Component
const ActionModal = ({ user, actionType, isOpen, onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    setFormData({});
  }, [actionType, isOpen]);

  if (!isOpen || !user || !actionType) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const actionConfigs = {
    warn: {
      title: 'Issue Warning',
      fields: [
        { name: 'warningType', label: 'Warning Type', type: 'select', options: [
          { value: 'policy_violation', label: 'Policy Violation' },
          { value: 'suspicious_activity', label: 'Suspicious Activity' },
          { value: 'abuse_report', label: 'Abuse Report' },
          { value: 'other', label: 'Other' },
        ]},
        { name: 'severity', label: 'Severity', type: 'select', options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ]},
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea', required: true },
      ],
    },
    suspend: {
      title: '⚠️ Suspend Account',
      fields: [
        { name: 'reason', label: 'Reason', type: 'textarea', required: true },
        { name: 'duration', label: 'Duration (days, empty for permanent)', type: 'number' },
      ],
      warning: 'This will temporarily prevent the user from accessing the platform. The user will be notified of this suspension.',
    },
    ban: {
      title: '🚫 Ban Account',
      fields: [
        { name: 'reason', label: 'Reason', type: 'textarea', required: true },
        { name: 'confirmBan', label: 'Type "BAN" to confirm', type: 'text', required: true },
      ],
      warning: 'PERMANENT ACTION: This will permanently ban the user from the platform. This action requires Super Admin privileges and should only be used for serious violations.',
    },
    unban: {
      title: 'Unban Account',
      fields: [
        { name: 'reason', label: 'Reason for unbanning', type: 'textarea', required: true },
      ],
    },
    adjust_trust: {
      title: 'Adjust Trust Score',
      fields: [
        { name: 'newScore', label: `New Score (current: ${user?.trust_score})`, type: 'number', min: 0, max: 100, required: true },
        { name: 'reason', label: 'Reason', type: 'textarea', required: true },
      ],
    },
    disable_chat: {
      title: 'Disable Chat',
      fields: [
        { name: 'reason', label: 'Reason', type: 'textarea', required: true },
      ],
    },
    enable_chat: {
      title: 'Enable Chat',
      fields: [],
      message: 'This will re-enable chat functionality for the user.',
    },
    block_claims: {
      title: 'Block Claims',
      fields: [
        { name: 'reason', label: 'Reason', type: 'textarea', required: true },
      ],
    },
    unblock_claims: {
      title: 'Unblock Claims',
      fields: [],
      message: 'This will allow the user to submit claims again.',
    },
  };

  const config = actionConfigs[actionType] || { title: 'Action', fields: [] };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Target user: <span className="font-medium">{user.email}</span>
          </div>

          {config.warning && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              ⚠️ {config.warning}
            </div>
          )}

          {config.message && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              ℹ️ {config.message}
            </div>
          )}

          {config.fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required={field.required}
                >
                  <option value="">Select...</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  required={field.required}
                />
              ) : (
                <input
                  type={field.type}
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  min={field.min}
                  max={field.max}
                  required={field.required}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminUsersPage;

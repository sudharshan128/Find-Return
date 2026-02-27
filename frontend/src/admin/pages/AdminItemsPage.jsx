/**
 * Admin Items Page
 * Item moderation with hide/delete/edit capabilities
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import {
  Search,
  Package,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  RotateCcw,
  Flag,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Image,
  AlertTriangle,
  CheckCircle,
  Gift,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminItemsPage = () => {
  const { adminProfile, isSuperAdmin, isModerator, loading: authLoading } = useAdminAuth();
  const [searchParams] = useSearchParams();
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [flaggedOnly, setFlaggedOnly] = useState(searchParams.get('flagged') === 'true');
  const [hiddenOnly, setHiddenOnly] = useState(searchParams.get('hidden') === 'true');

  // Modal states
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    // Guard: only fetch if auth is ready
    if (authLoading || !adminProfile?.id) {
      console.log('[ADMIN ITEMS] Auth not ready, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('[ADMIN ITEMS] Fetching items...');
      setLoading(true);
      setError(null);

      const result = await adminAPIClient.items.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        status: statusFilter || undefined,
        flagged: flaggedOnly || undefined,
        hidden: hiddenOnly || undefined,
      });
      setItems(result.data || []);
      setPagination(prev => ({ ...prev, total: result.total }));
      console.log('[ADMIN ITEMS] Items fetched:', (result.data || []).length);
    } catch (error) {
      console.error('[ADMIN ITEMS] Error fetching items:', error);
      setError(error.message || 'Failed to load items');
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, flaggedOnly, hiddenOnly, authLoading, adminProfile?.id]);

  useEffect(() => {
    if (!authLoading && adminProfile?.id) {
      fetchItems();
    } else if (authLoading) {
      console.log('[ADMIN ITEMS] Waiting for auth to load...');
    }
  }, [fetchItems, authLoading, adminProfile?.id]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchItems();
  };

  const openDetailModal = async (item) => {
    try {
      const fullItem = await adminAPIClient.items.get(item.id);
      setSelectedItem(fullItem);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load item details');
    }
  };

  const openActionModal = (item, action) => {
    setSelectedItem(item);
    setActionType(action);
    setShowActionModal(true);
  };

  const handleAction = async (reason) => {
    try {
      setActionLoading(true);

      switch (actionType) {
        case 'hide':
          await adminAPIClient.items.hide(selectedItem.id, reason);
          toast.success('Item hidden successfully');
          break;
        case 'unhide':
          await adminAPIClient.items.unhide(selectedItem.id, reason);
          toast.success('Item unhidden successfully');
          break;
        case 'soft_delete':
          await adminAPIClient.items.softDelete(selectedItem.id, reason);
          toast.success('Item soft deleted successfully');
          break;
        case 'restore':
          await adminAPIClient.items.restore(selectedItem.id, reason);
          toast.success('Item restored successfully');
          break;
        case 'hard_delete':
          await adminAPIClient.items.hardDelete(selectedItem.id, reason);
          toast.success('Item permanently deleted');
          break;
        case 'clear_flag':
          await adminAPIClient.items.clearFlag(selectedItem.id, reason);
          toast.success('Flag cleared successfully');
          break;
        case 'mark_returned':
          await adminAPIClient.items.markReturned(selectedItem.id, reason);
          toast.success('Item marked as returned successfully');
          break;
        default:
          break;
      }

      setShowActionModal(false);
      fetchItems();
    } catch (error) {
      console.error('Action error:', error);
      toast.error(`Failed to ${actionType}: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (item) => {
    if (item.is_soft_deleted) return { color: 'bg-gray-100 text-gray-800', text: 'Deleted' };
    if (item.is_hidden) return { color: 'bg-yellow-100 text-yellow-800', text: 'Hidden' };
    if (item.is_flagged) return { color: 'bg-red-100 text-red-800', text: 'Flagged' };
    
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      claimed: 'bg-blue-100 text-blue-800',
      returned: 'bg-purple-100 text-purple-800',
      expired: 'bg-gray-100 text-gray-800',
      removed: 'bg-red-100 text-red-800',
    };
    
    return { color: statusColors[item.status] || 'bg-gray-100 text-gray-800', text: item.status };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Item Moderation</h1>
          <p className="text-gray-500">Review and moderate platform items</p>
        </div>
        <button
          onClick={fetchItems}
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
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
            <option value="claimed">Claimed</option>
            <option value="returned">Returned</option>
            <option value="expired">Expired</option>
          </select>

          <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Flagged Only</span>
          </label>

          <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={hiddenOnly}
              onChange={(e) => setHiddenOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Hidden Only</span>
          </label>

          <button
            type="submit"
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
      </div>

      {/* Items Grid */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No items found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category/Area</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Finder</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claims</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => {
                    const statusBadge = getStatusBadge(item);
                    const primaryImage = item.item_images?.find(img => img.is_primary) || item.item_images?.[0];

                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 ${item.is_soft_deleted ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                              {primaryImage?.image_url ? (
                                <img
                                  src={primaryImage.image_url}
                                  alt=""
                                  className="h-12 w-12 object-cover"
                                />
                              ) : (
                                <div className="h-12 w-12 flex items-center justify-center">
                                  <Image className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">
                                {item.title}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">{item.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{item.categories?.icon} {item.categories?.name}</div>
                          <div className="text-xs text-gray-500">{item.areas?.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{item.user_profiles?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">Trust: {item.user_profiles?.trust_score}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
                              {statusBadge.text}
                            </span>
                            {item.is_flagged && !item.is_soft_deleted && (
                              <span className="inline-flex items-center text-xs text-red-600">
                                <Flag className="h-3 w-3 mr-1" />
                                {item.flag_reason || 'Flagged'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.total_claims || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openDetailModal(item)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            
                            {isModerator() && !item.is_soft_deleted && (
                              <>
                                {item.is_flagged && (
                                  <button
                                    onClick={() => openActionModal(item, 'clear_flag')}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                    title="Clear flag"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                )}
                                
                                {item.is_hidden ? (
                                  <button
                                    onClick={() => openActionModal(item, 'unhide')}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                    title="Unhide"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openActionModal(item, 'hide')}
                                    className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                                    title="Hide"
                                  >
                                    <EyeOff className="h-4 w-4" />
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => openActionModal(item, 'soft_delete')}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Soft delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                
                                {/* Mark as Returned - only for claimed items */}
                                {item.status === 'claimed' && (
                                  <button
                                    onClick={() => openActionModal(item, 'mark_returned')}
                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                                    title="Mark as Returned"
                                  >
                                    <Gift className="h-4 w-4" />
                                  </button>
                                )}
                              </>
                            )}
                            
                            {item.is_soft_deleted && isModerator() && (
                              <button
                                onClick={() => openActionModal(item, 'restore')}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                title="Restore"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                            
                            {item.is_soft_deleted && isSuperAdmin() && (
                              <button
                                onClick={() => openActionModal(item, 'hard_delete')}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Permanent delete"
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page * pagination.limit >= pagination.total}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setShowDetailModal(false)}
        />
      )}

      {/* Action Modal */}
      {showActionModal && selectedItem && (
        <ActionConfirmModal
          item={selectedItem}
          actionType={actionType}
          loading={actionLoading}
          onConfirm={handleAction}
          onClose={() => setShowActionModal(false)}
        />
      )}
    </div>
  );
};

// Item Detail Modal
const ItemDetailModal = ({ item, onClose }) => {
  const [moderationHistory, setModerationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await adminAPIClient.items.getModerationHistory(item.id);
        setModerationHistory(history);
      } catch (error) {
        console.error('Error fetching moderation history:', error);
      }
      setLoadingHistory(false);
    };
    fetchHistory();
  }, [item.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Item Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Images */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Images</h3>
              <div className="grid grid-cols-2 gap-2">
                {item.item_images?.length > 0 ? (
                  item.item_images.map((img, idx) => (
                    <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={img.image_url}
                        alt={`Item image ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 aspect-video rounded-lg bg-gray-100 flex items-center justify-center">
                    <Image className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Basic Information</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Title</dt>
                    <dd className="text-sm font-medium text-gray-900">{item.title}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Category</dt>
                    <dd className="text-sm text-gray-900">{item.categories?.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Area</dt>
                    <dd className="text-sm text-gray-900">{item.areas?.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Status</dt>
                    <dd className="text-sm text-gray-900 capitalize">{item.status}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Date Found</dt>
                    <dd className="text-sm text-gray-900">{new Date(item.date_found).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Views</dt>
                    <dd className="text-sm text-gray-900">{item.view_count}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Total Claims</dt>
                    <dd className="text-sm text-gray-900">{item.total_claims}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {item.description || 'No description provided'}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Security Question</h4>
                <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">
                  {item.security_question}
                </p>
              </div>
            </div>
          </div>

          {/* Finder Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">Finder Information</h3>
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                {item.user_profiles?.avatar_url ? (
                  <img src={item.user_profiles.avatar_url} alt="" className="h-12 w-12 rounded-full" />
                ) : (
                  <span className="text-gray-500 font-medium">
                    {item.user_profiles?.full_name?.charAt(0) || '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{item.user_profiles?.full_name || 'Unknown'}</p>
                <p className="text-sm text-gray-500">{item.user_profiles?.email}</p>
                <p className="text-sm text-gray-500">Trust Score: {item.user_profiles?.trust_score}</p>
              </div>
            </div>
          </div>

          {/* Claims */}
          {item.claims?.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-3">Claims ({item.claims.length})</h3>
              <div className="space-y-2">
                {item.claims.map((claim) => (
                  <div key={claim.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {claim.user_profiles?.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(claim.created_at).toLocaleString()}
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
                ))}
              </div>
            </div>
          )}

          {/* Moderation History */}
          <div className="mt-6">
            <h3 className="font-medium text-gray-900 mb-3">Moderation History</h3>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              </div>
            ) : moderationHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No moderation actions taken</p>
            ) : (
              <div className="space-y-2">
                {moderationHistory.map((entry) => (
                  <div key={entry.id} className="flex items-start space-x-3 text-sm">
                    <span className="text-gray-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                    <span className="font-medium text-gray-900">{entry.action}</span>
                    <span className="text-gray-600">by {entry.admin_users?.full_name || 'Unknown'}</span>
                    <span className="text-gray-500">- {entry.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Action Confirm Modal
const ActionConfirmModal = ({ item, actionType, loading, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const actionConfigs = {
    hide: {
      title: 'Hide Item',
      description: 'This will hide the item from public view. It can be unhidden later.',
      confirmText: 'Hide Item',
      confirmClass: 'bg-yellow-600 hover:bg-yellow-700',
    },
    unhide: {
      title: 'Unhide Item',
      description: 'This will make the item visible to the public again.',
      confirmText: 'Unhide Item',
      confirmClass: 'bg-green-600 hover:bg-green-700',
    },
    soft_delete: {
      title: 'Soft Delete Item',
      description: 'This will mark the item as deleted but keep it in the database for records.',
      confirmText: 'Delete Item',
      confirmClass: 'bg-red-600 hover:bg-red-700',
    },
    restore: {
      title: 'Restore Item',
      description: 'This will restore the soft-deleted item.',
      confirmText: 'Restore Item',
      confirmClass: 'bg-green-600 hover:bg-green-700',
    },
    hard_delete: {
      title: '🚨 Permanently Delete Item',
      description: 'DANGER: This will permanently delete the item, all claims, chat history, and associated data. THIS ACTION CANNOT BE UNDONE!',
      confirmText: 'Permanently Delete',
      confirmClass: 'bg-red-700 hover:bg-red-800',
      requireConfirmation: true,
    },
    clear_flag: {
      title: 'Clear Flag',
      description: 'This will remove the flag from the item after review.',
      confirmText: 'Clear Flag',
      confirmClass: 'bg-green-600 hover:bg-green-700',
    },
    mark_returned: {
      title: '✅ Mark Item as Returned',
      description: 'This confirms the item has been successfully returned to its rightful owner. Trust scores will be updated for both finder and claimant.',
      confirmText: 'Confirm Return',
      confirmClass: 'bg-purple-600 hover:bg-purple-700',
    },
  };

  const config = actionConfigs[actionType] || { title: 'Action', description: '', confirmText: 'Confirm', confirmClass: 'bg-indigo-600' };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (config.requireConfirmation && confirmText !== 'DELETE') {
      return;
    }
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {actionType === 'hard_delete' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-800">⚠️ This is a destructive action</p>
              <p className="text-xs text-red-700 mt-1">All associated data will be permanently lost.</p>
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{item.title}</p>
            <p className="text-xs text-gray-500">ID: {item.id}</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={3}
              required
              placeholder="Enter reason for this action..."
            />
          </div>

          {config.requireConfirmation && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type "DELETE" to confirm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="DELETE"
              />
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim() || (config.requireConfirmation && confirmText !== 'DELETE')}
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${config.confirmClass}`}
            >
              {loading ? 'Processing...' : config.confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminItemsPage;

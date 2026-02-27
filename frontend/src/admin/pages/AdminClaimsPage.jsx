/**
 * Admin Claims Page
 * Claim moderation with dispute handling
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import {
  Search,
  FileText,
  Eye,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  MessageSquare,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  StickyNote,
  Clock,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminClaimsPage = () => {
  const { adminProfile, isSuperAdmin, isModerator, loading: authLoading } = useAdminAuth();
  const [searchParams] = useSearchParams();
  
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [lockedOnly, setLockedOnly] = useState(searchParams.get('locked') === 'true');
  const [disputedOnly, setDisputedOnly] = useState(searchParams.get('disputed') === 'true');

  // Modal states
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchClaims = useCallback(async () => {
    // Guard: only fetch if auth is ready
    if (authLoading || !adminProfile?.id) {
      console.log('[ADMIN CLAIMS] Auth not ready, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('[ADMIN CLAIMS] Fetching claims...');
      setLoading(true);
      setError(null);

      const result = await adminAPIClient.claims.getAll({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
        locked: lockedOnly || undefined,
        disputed: disputedOnly || undefined,
      });
      setClaims(result.data || []);
      setPagination(prev => ({ ...prev, total: result.total }));
      console.log('[ADMIN CLAIMS] Claims fetched:', (result.data || []).length);
    } catch (err) {
      console.error('[ADMIN CLAIMS] Error fetching claims:', err);
      setError(err.message || 'Failed to load claims');
      toast.error('Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, lockedOnly, disputedOnly, authLoading, adminProfile?.id]);

  useEffect(() => {
    if (!authLoading && adminProfile?.id) {
      fetchClaims();
    } else if (authLoading) {
      console.log('[ADMIN CLAIMS] Waiting for auth to load...');
    }
  }, [fetchClaims, authLoading, adminProfile?.id]);

  const openDetailModal = async (claim) => {
    try {
      const fullClaim = await adminAPIClient.claims.get(claim.id);
      setSelectedClaim(fullClaim);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load claim details');
    }
  };

  const openActionModal = (claim, action) => {
    setSelectedClaim(claim);
    setActionType(action);
    setShowActionModal(true);
  };

  const openNoteModal = (claim) => {
    setSelectedClaim(claim);
    setShowNoteModal(true);
  };

  const handleAction = async (reason) => {
    try {
      setActionLoading(true);

      switch (actionType) {
        case 'lock':
          await adminAPIClient.claims.lock(selectedClaim.id, reason);
          toast.success('Claim locked successfully');
          break;
        case 'unlock':
          await adminAPIClient.claims.unlock(selectedClaim.id, reason);
          toast.success('Claim unlocked successfully');
          break;
        case 'approve':
          await adminAPIClient.claims.approve(selectedClaim.id);
          toast.success('Claim approved by admin override');
          break;
        case 'reject':
          await adminAPIClient.claims.reject(selectedClaim.id, reason);
          toast.success('Claim rejected by admin override');
          break;
        case 'flag_dispute':
          await adminAPIClient.claims.flagDispute(selectedClaim.id, reason);
          toast.success('Claim flagged as disputed');
          break;
        case 'resolve_dispute':
          await adminAPIClient.claims.resolveDispute(selectedClaim.id, 'resolved', reason);
          toast.success('Dispute resolved');
          break;
        default:
          break;
      }

      setShowActionModal(false);
      fetchClaims();
    } catch (error) {
      console.error('Action error:', error);
      toast.error(`Failed to ${actionType}: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (noteText) => {
    try {
      setActionLoading(true);
      await adminAPIClient.claims.addNote(selectedClaim.id, noteText);
      toast.success('Note added successfully');
      setShowNoteModal(false);
      fetchClaims();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (claim) => {
    if (claim.is_disputed) return { color: 'bg-orange-100 text-orange-800', text: 'Disputed' };
    if (claim.is_locked) return { color: 'bg-gray-100 text-gray-800', text: 'Locked' };
    
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    
    return { color: statusColors[claim.status] || 'bg-gray-100 text-gray-800', text: claim.status };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Claims Moderation</h1>
          <p className="text-gray-500">Review and manage ownership claims</p>
        </div>
        <button
          onClick={fetchClaims}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={lockedOnly}
              onChange={(e) => setLockedOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Locked Only</span>
          </label>

          <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={disputedOnly}
              onChange={(e) => setDisputedOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Disputed Only</span>
          </label>

          <button
            onClick={fetchClaims}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No claims found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claim</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claimant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Notes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {claims.map((claim) => {
                    const statusBadge = getStatusBadge(claim);

                    return (
                      <tr key={claim.id} className={`hover:bg-gray-50 ${claim.is_locked ? 'bg-gray-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-mono text-gray-900">{claim.id.slice(0, 8)}...</div>
                            {claim.admin_override && (
                              <span className="text-xs text-purple-600 flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Admin Override
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-[200px] truncate">
                            {claim.items?.title || 'Unknown Item'}
                          </div>
                          <div className="text-xs text-gray-500">
                            by {claim.items?.user_profiles?.full_name || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              {claim.user_profiles?.avatar_url ? (
                                <img src={claim.user_profiles.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                              ) : (
                                <User className="h-4 w-4 text-gray-500" />
                              )}
                            </div>
                            <div className="ml-3">
                              <div className="text-sm text-gray-900">{claim.user_profiles?.full_name}</div>
                              <div className="text-xs text-gray-500">Trust: {claim.user_profiles?.trust_score}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
                              {statusBadge.text}
                            </span>
                            {claim.is_locked && (
                              <span className="inline-flex items-center text-xs text-gray-500">
                                <Lock className="h-3 w-3 mr-1" />
                                Locked
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500">
                            {claim.claim_admin_notes?.length || 0} notes
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(claim.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openDetailModal(claim)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => openNoteModal(claim)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Add note"
                            >
                              <StickyNote className="h-4 w-4" />
                            </button>

                            {isModerator() && (
                              <>
                                {claim.is_locked ? (
                                  <button
                                    onClick={() => openActionModal(claim, 'unlock')}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                    title="Unlock"
                                  >
                                    <Unlock className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openActionModal(claim, 'lock')}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    title="Lock"
                                  >
                                    <Lock className="h-4 w-4" />
                                  </button>
                                )}

                                {claim.status === 'pending' && !claim.is_locked && (
                                  <>
                                    <button
                                      onClick={() => openActionModal(claim, 'approve')}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                      title="Override Approve"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => openActionModal(claim, 'reject')}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                      title="Override Reject"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </button>
                                  </>
                                )}

                                {!claim.is_disputed ? (
                                  <button
                                    onClick={() => openActionModal(claim, 'flag_dispute')}
                                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                                    title="Flag as Disputed"
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openActionModal(claim, 'resolve_dispute')}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                    title="Resolve Dispute"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </>
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
      {showDetailModal && selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setShowDetailModal(false)}
        />
      )}

      {/* Action Modal */}
      {showActionModal && selectedClaim && (
        <ActionConfirmModal
          claim={selectedClaim}
          actionType={actionType}
          loading={actionLoading}
          onConfirm={handleAction}
          onClose={() => setShowActionModal(false)}
        />
      )}

      {/* Note Modal */}
      {showNoteModal && selectedClaim && (
        <AddNoteModal
          claim={selectedClaim}
          loading={actionLoading}
          onSubmit={handleAddNote}
          onClose={() => setShowNoteModal(false)}
        />
      )}
    </div>
  );
};

// Claim Detail Modal
const ClaimDetailModal = ({ claim, onClose }) => {
  const [adminNotes, setAdminNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const notes = await adminAPIClient.claims.getNotes(claim.id);
        setAdminNotes(notes);
      } catch (error) {
        console.error('Error fetching notes:', error);
      }
      setLoadingNotes(false);
    };
    fetchNotes();
  }, [claim.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Claim Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Claim Info */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Claim Information</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Claim ID</dt>
                  <dd className="text-sm font-mono text-gray-900">{claim.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd className="text-sm text-gray-900 capitalize">{claim.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-900">{new Date(claim.created_at).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Is Locked</dt>
                  <dd className="text-sm text-gray-900">{claim.is_locked ? 'Yes' : 'No'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Is Disputed</dt>
                  <dd className="text-sm text-gray-900">{claim.is_disputed ? 'Yes' : 'No'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Admin Override</dt>
                  <dd className="text-sm text-gray-900">{claim.admin_override ? 'Yes' : 'No'}</dd>
                </div>
              </dl>

              {/* Security Answer */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Security Answer</h4>
                <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  {claim.security_answer || 'No answer provided'}
                </p>
              </div>

              {/* Claimant Message */}
              {claim.message && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Claimant Message</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {claim.message}
                  </p>
                </div>
              )}
            </div>

            {/* Item & Users */}
            <div className="space-y-4">
              {/* Item Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Item Being Claimed</h4>
                <div className="flex items-start space-x-3">
                  {claim.items?.item_images?.[0]?.image_url && (
                    <img
                      src={claim.items.item_images[0].image_url}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{claim.items?.title}</p>
                    <p className="text-xs text-gray-500">{claim.items?.categories?.name}</p>
                    <p className="text-xs text-gray-500">Posted by: {claim.items?.user_profiles?.full_name}</p>
                  </div>
                </div>
              </div>

              {/* Claimant Info */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Claimant</h4>
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center">
                    {claim.user_profiles?.avatar_url ? (
                      <img src={claim.user_profiles.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                    ) : (
                      <User className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{claim.user_profiles?.full_name}</p>
                    <p className="text-xs text-gray-500">{claim.user_profiles?.email}</p>
                    <p className="text-xs text-gray-500">Trust Score: {claim.user_profiles?.trust_score}</p>
                  </div>
                </div>
              </div>

              {/* Security Question */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Security Question (Item)</h4>
                <p className="text-sm text-gray-600">{claim.items?.security_question}</p>
              </div>
            </div>
          </div>

          {/* Admin Notes Section */}
          <div className="mt-6">
            <h3 className="font-medium text-gray-900 mb-3">Admin Notes</h3>
            {loadingNotes ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              </div>
            ) : adminNotes.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No admin notes yet</p>
            ) : (
              <div className="space-y-3">
                {adminNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-gray-50 rounded-lg border-l-4 border-indigo-500">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {note.admin_users?.full_name || 'Admin'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{note.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Messages (if any) */}
          {claim.chats && claim.chats.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-3">Associated Chat</h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Chat ID: <span className="font-mono">{claim.chats[0].id}</span>
                </p>
                <p className="text-sm text-gray-500">
                  Messages: {claim.chats[0].messages?.length || 0}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Action Confirm Modal
const ActionConfirmModal = ({ claim, actionType, loading, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');

  const actionConfigs = {
    lock: {
      title: 'Lock Claim',
      description: 'This will prevent any further actions on this claim until unlocked.',
      confirmText: 'Lock Claim',
      confirmClass: 'bg-gray-600 hover:bg-gray-700',
    },
    unlock: {
      title: 'Unlock Claim',
      description: 'This will allow normal claim processing to resume.',
      confirmText: 'Unlock Claim',
      confirmClass: 'bg-green-600 hover:bg-green-700',
    },
    approve: {
      title: 'Admin Override: Approve',
      description: 'This will approve the claim with admin override, bypassing normal verification.',
      confirmText: 'Approve Claim',
      confirmClass: 'bg-green-600 hover:bg-green-700',
    },
    reject: {
      title: 'Admin Override: Reject',
      description: 'This will reject the claim with admin override.',
      confirmText: 'Reject Claim',
      confirmClass: 'bg-red-600 hover:bg-red-700',
    },
    flag_dispute: {
      title: 'Flag as Disputed',
      description: 'This will mark the claim as disputed for further investigation.',
      confirmText: 'Flag Dispute',
      confirmClass: 'bg-orange-600 hover:bg-orange-700',
    },
    resolve_dispute: {
      title: 'Resolve Dispute',
      description: 'This will mark the dispute as resolved.',
      confirmText: 'Resolve',
      confirmClass: 'bg-green-600 hover:bg-green-700',
    },
  };

  const config = actionConfigs[actionType] || { title: 'Action', description: '', confirmText: 'Confirm', confirmClass: 'bg-indigo-600' };

  const handleSubmit = (e) => {
    e.preventDefault();
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
          <div className="mb-4">
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Claim for:</p>
            <p className="text-sm font-medium text-gray-900">{claim.items?.title || 'Unknown Item'}</p>
            <p className="text-xs text-gray-500">by {claim.user_profiles?.full_name}</p>
          </div>

          <div className="mb-6">
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
              disabled={loading || !reason.trim()}
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

// Add Note Modal
const AddNoteModal = ({ claim, loading, onSubmit, onClose }) => {
  const [noteText, setNoteText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(noteText);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Add Admin Note</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Adding note to claim for:</p>
            <p className="text-sm font-medium text-gray-900">{claim.items?.title || 'Unknown Item'}</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note <span className="text-red-500">*</span>
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={4}
              required
              placeholder="Enter your note..."
            />
          </div>

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
              disabled={loading || !noteText.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminClaimsPage;

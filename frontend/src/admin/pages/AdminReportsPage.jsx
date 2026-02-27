/**
 * Admin Reports Page
 * Abuse report management and resolution
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import {
  AlertTriangle,
  Eye,
  CheckCircle,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  Package,
  MessageSquare,
  FileText,
  Clock,
  Flag,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminReportsPage = () => {
  const { adminProfile, isModerator, loading: authLoading } = useAdminAuth();
  const [searchParams] = useSearchParams();
  
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [typeFilter, setTypeFilter] = useState('');

  // Modal states
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    // Guard: only fetch if auth is ready
    if (authLoading || !adminProfile?.id) {
      console.log('[ADMIN REPORTS] Auth not ready, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('[ADMIN REPORTS] Fetching reports...');
      setLoading(true);
      setError(null);

      const result = await adminAPIClient.reports.getAll({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      });
      setReports(result.data || []);
      setPagination(prev => ({ ...prev, total: result.total }));
      console.log('[ADMIN REPORTS] Reports fetched:', (result.data || []).length);
    } catch (error) {
      console.error('[ADMIN REPORTS] Error fetching reports:', error);
      setError(error.message || 'Failed to load reports');
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, typeFilter, authLoading, adminProfile?.id]);

  useEffect(() => {
    if (!authLoading && adminProfile?.id) {
      fetchReports();
    } else if (authLoading) {
      console.log('[ADMIN REPORTS] Waiting for auth to load...');
    }
  }, [fetchReports, authLoading, adminProfile?.id]);

  const openDetailModal = async (report) => {
    try {
      const fullReport = await adminAPIClient.reports.get(report.id);
      setSelectedReport(fullReport);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load report details');
    }
  };

  const openActionModal = (report, action) => {
    setSelectedReport(report);
    setActionType(action);
    setShowActionModal(true);
  };

  const handleAction = async (resolution) => {
    try {
      setActionLoading(true);

      switch (actionType) {
        case 'resolve':
          await adminAPIClient.reports.resolve(selectedReport.id, resolution);
          toast.success('Report resolved successfully');
          break;
        case 'dismiss':
          await adminAPIClient.reports.dismiss(selectedReport.id, resolution);
          toast.success('Report dismissed');
          break;
        case 'escalate':
          await adminAPIClient.reports.escalate(selectedReport.id, resolution);
          toast.success('Report escalated');
          break;
        default:
          break;
      }

      setShowActionModal(false);
      fetchReports();
    } catch (error) {
      console.error('Action error:', error);
      toast.error(`Failed to ${actionType}: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getReportTypeIcon = (type) => {
    switch (type) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'item':
        return <Package className="h-4 w-4" />;
      case 'chat':
        return <MessageSquare className="h-4 w-4" />;
      case 'claim':
        return <FileText className="h-4 w-4" />;
      default:
        return <Flag className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      dismissed: 'bg-gray-100 text-gray-800',
      escalated: 'bg-red-100 text-red-800',
    };
    
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityBadge = (severity) => {
    const severityColors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    
    return severityColors[severity] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abuse Reports</h1>
          <p className="text-gray-500">Review and resolve user reports</p>
        </div>
        <button
          onClick={fetchReports}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Pending"
          value={reports.filter(r => r.status === 'pending').length}
          color="yellow"
          icon={Clock}
        />
        <StatCard
          title="Under Review"
          value={reports.filter(r => r.status === 'under_review').length}
          color="blue"
          icon={Eye}
        />
        <StatCard
          title="Resolved"
          value={reports.filter(r => r.status === 'resolved').length}
          color="green"
          icon={CheckCircle}
        />
        <StatCard
          title="Escalated"
          value={reports.filter(r => r.status === 'escalated').length}
          color="red"
          icon={AlertTriangle}
        />
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
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="escalated">Escalated</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            <option value="user">User</option>
            <option value="item">Item</option>
            <option value="chat">Chat</option>
            <option value="claim">Claim</option>
          </select>

          <button
            onClick={fetchReports}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No reports found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reporter</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">
                            {report.reason}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{report.id.slice(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          {getReportTypeIcon(report.report_type)}
                          <span className="ml-2 capitalize">{report.report_type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            {report.reporter_profile?.avatar_url ? (
                              <img src={report.reporter_profile.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                            ) : (
                              <User className="h-4 w-4 text-gray-500" />
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm text-gray-900">{report.reporter_profile?.full_name || 'Unknown'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {report.reported_user_profile?.full_name || 
                           report.reported_item?.title || 
                           report.reported_entity_id?.slice(0, 8) + '...'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(report.status)}`}>
                          {report.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(report.severity)}`}>
                          {report.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(report.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openDetailModal(report)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {isModerator() && report.status !== 'resolved' && report.status !== 'dismissed' && (
                            <>
                              <button
                                onClick={() => openActionModal(report, 'resolve')}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                title="Resolve"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openActionModal(report, 'dismiss')}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                title="Dismiss"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openActionModal(report, 'escalate')}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Escalate"
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
      {showDetailModal && selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setShowDetailModal(false)}
        />
      )}

      {/* Action Modal */}
      {showActionModal && selectedReport && (
        <ActionConfirmModal
          report={selectedReport}
          actionType={actionType}
          loading={actionLoading}
          onConfirm={handleAction}
          onClose={() => setShowActionModal(false)}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, color, icon: Icon }) => {
  const colors = {
    yellow: 'bg-yellow-50 text-yellow-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

// Report Detail Modal
const ReportDetailModal = ({ report, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Report Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Report Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500">Report ID</p>
              <p className="text-sm font-mono text-gray-900">{report.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="text-sm text-gray-900 capitalize">{report.report_type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-sm text-gray-900 capitalize">{report.status.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Severity</p>
              <p className="text-sm text-gray-900 capitalize">{report.severity}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="text-sm text-gray-900">{new Date(report.created_at).toLocaleString()}</p>
            </div>
            {report.resolved_at && (
              <div>
                <p className="text-sm text-gray-500">Resolved</p>
                <p className="text-sm text-gray-900">{new Date(report.resolved_at).toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Reporter */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Reporter</h3>
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center">
                {report.reporter_profile?.avatar_url ? (
                  <img src={report.reporter_profile.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <User className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{report.reporter_profile?.full_name}</p>
                <p className="text-xs text-gray-500">{report.reporter_profile?.email}</p>
              </div>
            </div>
          </div>

          {/* Reported Entity */}
          <div className="mb-6 p-4 bg-red-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Reported {report.report_type}</h3>
            {report.report_type === 'user' && report.reported_user_profile && (
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-red-200 flex items-center justify-center">
                  {report.reported_user_profile.avatar_url ? (
                    <img src={report.reported_user_profile.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                  ) : (
                    <User className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{report.reported_user_profile.full_name}</p>
                  <p className="text-xs text-gray-500">Trust Score: {report.reported_user_profile.trust_score}</p>
                </div>
              </div>
            )}
            {report.report_type === 'item' && report.reported_item && (
              <div>
                <p className="text-sm font-medium text-gray-900">{report.reported_item.title}</p>
                <p className="text-xs text-gray-500">By: {report.reported_item.user_profiles?.full_name}</p>
              </div>
            )}
            {!report.reported_user_profile && !report.reported_item && (
              <p className="text-sm text-gray-500">Entity ID: {report.reported_entity_id}</p>
            )}
          </div>

          {/* Reason */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Reason</h3>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{report.reason}</p>
          </div>

          {/* Description */}
          {report.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                {report.description}
              </p>
            </div>
          )}

          {/* Evidence */}
          {report.evidence && report.evidence.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Evidence</h3>
              <div className="grid grid-cols-3 gap-2">
                {report.evidence.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Evidence ${idx + 1}`} className="rounded-lg h-24 w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Resolution */}
          {report.resolution && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Resolution</h3>
              <p className="text-sm text-gray-600">{report.resolution}</p>
              {report.resolved_by_admin && (
                <p className="text-xs text-gray-500 mt-2">
                  By: {report.resolved_by_admin.full_name}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Action Confirm Modal
const ActionConfirmModal = ({ report, actionType, loading, onConfirm, onClose }) => {
  const [resolution, setResolution] = useState('');

  const actionConfigs = {
    resolve: {
      title: 'Resolve Report',
      description: 'Mark this report as resolved after taking appropriate action.',
      confirmText: 'Resolve',
      confirmClass: 'bg-green-600 hover:bg-green-700',
    },
    dismiss: {
      title: 'Dismiss Report',
      description: 'Dismiss this report if it is invalid or does not warrant action.',
      confirmText: 'Dismiss',
      confirmClass: 'bg-gray-600 hover:bg-gray-700',
    },
    escalate: {
      title: 'Escalate Report',
      description: 'Escalate this report to super admin for serious violations.',
      confirmText: 'Escalate',
      confirmClass: 'bg-red-600 hover:bg-red-700',
    },
  };

  const config = actionConfigs[actionType] || { title: 'Action', description: '', confirmText: 'Confirm', confirmClass: 'bg-indigo-600' };

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(resolution);
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
            <p className="text-sm text-gray-500">Report:</p>
            <p className="text-sm font-medium text-gray-900">{report.reason}</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resolution Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={4}
              required
              placeholder="Describe the action taken or reason for this decision..."
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
              disabled={loading || !resolution.trim()}
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

export default AdminReportsPage;

/**
 * Admin Audit Logs Page
 * View immutable audit trail of all admin actions
 */

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAPIClient } from '../lib/apiClient';
import {
  Shield,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Download,
  Calendar,
  User,
  Activity,
  Lock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  UserPlus,
  Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminAuditLogsPage = () => {
  const { isSuperAdmin, loading: authLoading } = useAdminAuth();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [importantOnly, setImportantOnly] = useState(true); // Default to important only

  // Modal states
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Available admins for filter
  const [admins, setAdmins] = useState([]);

  const fetchLogs = useCallback(async () => {
    if (authLoading) {
      console.log('[AUDIT LOGS] Auth not ready, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('[AUDIT LOGS] Fetching logs...');
      setLoading(true);
      setError(null);

      const result = await adminAPIClient.audit.getLogs({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        action: actionFilter || undefined,
        adminId: adminFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        importantOnly: importantOnly,
      });
      setLogs(result.logs || []);
      setPagination(prev => ({ ...prev, total: result.total }));
      console.log('[AUDIT LOGS] Logs fetched:', (result.logs || []).length);
    } catch (error) {
      console.error('[AUDIT LOGS] Error fetching audit logs:', error);
      setError(error.message || 'Failed to load audit logs');
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, actionFilter, adminFilter, dateFrom, dateTo, importantOnly, authLoading]);

  const fetchAdmins = async () => {
    try {
      // getLoginHistory returns { logins: [], total, limit, offset }
      // We need to extract unique admins from the logins array
      const result = await adminAPIClient.audit.getLoginHistory();
      const logins = result?.logins || [];
      
      // Extract unique admins from login history
      const uniqueAdmins = [];
      const seenIds = new Set();
      
      for (const login of logins) {
        if (login.admin_id && !seenIds.has(login.admin_id)) {
          seenIds.add(login.admin_id);
          uniqueAdmins.push({
            id: login.admin_id,
            full_name: login.admin_email || login.email || `Admin ${login.admin_id.slice(0, 8)}`,
            email: login.admin_email || login.email
          });
        }
      }
      
      setAdmins(uniqueAdmins);
    } catch (error) {
      console.error('[AUDIT LOGS] Error fetching admins:', error);
      setAdmins([]); // Ensure admins is always an array
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchLogs();
      fetchAdmins();
    }
  }, [fetchLogs, authLoading]);

  const handleSearch = (e) => {
    e.preventDefault();
    // Reset to page 1 when applying filters - this will trigger fetchLogs via useEffect
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExport = async () => {
    try {
      toast.loading('Generating export...');
      const data = await adminAPIClient.audit.export({
        action: actionFilter || undefined,
        adminId: adminFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      
      toast.dismiss();
      
      // Check if there are any logs to export
      if (!data.logs || data.logs.length === 0) {
        toast.error('No audit logs found for the selected filters');
        return;
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${data.totalRecords} audit log${data.totalRecords !== 1 ? 's' : ''}`);
    } catch (error) {
      toast.dismiss();
      toast.error('Export failed: ' + (error.message || 'Unknown error'));
    }
  };

  const openDetailModal = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const getActionIcon = (action) => {
    const icons = {
      login: <User className="h-4 w-4" />,
      logout: <User className="h-4 w-4" />,
      create: <UserPlus className="h-4 w-4" />,
      update: <Edit className="h-4 w-4" />,
      delete: <Trash2 className="h-4 w-4" />,
      approve: <CheckCircle className="h-4 w-4" />,
      reject: <XCircle className="h-4 w-4" />,
      ban: <Ban className="h-4 w-4" />,
      suspend: <AlertTriangle className="h-4 w-4" />,
      view: <Eye className="h-4 w-4" />,
      export: <Download className="h-4 w-4" />,
    };
    
    // Find matching icon
    for (const [key, icon] of Object.entries(icons)) {
      if (action.toLowerCase().includes(key)) {
        return icon;
      }
    }
    return <Activity className="h-4 w-4" />;
  };

  const getActionColor = (action) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('delete') || actionLower.includes('ban') || actionLower.includes('remove')) {
      return 'bg-red-100 text-red-800';
    }
    if (actionLower.includes('approve') || actionLower.includes('create') || actionLower.includes('restore')) {
      return 'bg-green-100 text-green-800';
    }
    if (actionLower.includes('suspend') || actionLower.includes('warn') || actionLower.includes('flag')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (actionLower.includes('view') || actionLower.includes('access')) {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const actionTypes = [
    'admin_login',
    'admin_logout',
    'user_warn',
    'user_suspend',
    'user_ban',
    'user_unban',
    'trust_adjust',
    'item_hide',
    'item_unhide',
    'item_delete',
    'item_restore',
    'claim_lock',
    'claim_unlock',
    'claim_override',
    'chat_freeze',
    'chat_unfreeze',
    'chat_access',
    'message_delete',
    'report_resolve',
    'report_dismiss',
    'setting_update',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500">Immutable record of all admin actions</p>
        </div>
        <div className="flex items-center space-x-3">
          {isSuperAdmin() && (
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          )}
          <button
            onClick={fetchLogs}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Lock className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-green-800">Tamper-Proof Audit Trail</h3>
            <p className="text-sm text-green-700 mt-1">
              All entries are cryptographically checksummed and cannot be modified or deleted.
              Each entry includes the previous entry's checksum for chain verification.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Actions</option>
                {actionTypes.map(action => (
                  <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin</label>
              <select
                value={adminFilter}
                onChange={(e) => setAdminFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Admins</option>
                {Array.isArray(admins) && admins.map(admin => (
                  <option key={admin.id} value={admin.id}>{admin.full_name || admin.email}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={importantOnly}
                  onChange={(e) => setImportantOnly(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Show important actions only
                  <span className="block text-xs text-gray-500">Hides read/view actions</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(log.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {log.reason || log.admin_id?.slice(0, 8) || 'System'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                          {getActionIcon(log.action)}
                          <span className="ml-1">{log.action.replace(/_/g, ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <span className="font-medium">{log.resource_type}</span>
                          {log.resource_id && (
                            <div className="text-xs text-gray-500 font-mono">{log.resource_id.slice(0, 8)}...</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.resource_action === 'success' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Success
                          </span>
                        ) : log.resource_action === 'failure' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failure
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">{log.resource_action || '-'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.ip_address || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => openDetailModal(log)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
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
      {showDetailModal && selectedLog && (
        <AuditLogDetailModal
          log={selectedLog}
          onClose={() => setShowDetailModal(false)}
        />
      )}
    </div>
  );
};

// Audit Log Detail Modal
const AuditLogDetailModal = ({ log, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Audit Log Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500">Log ID</p>
              <p className="text-sm font-mono text-gray-900">{log.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Timestamp</p>
              <p className="text-sm text-gray-900">{new Date(log.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Action</p>
              <p className="text-sm text-gray-900 font-medium">{log.action.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-sm text-gray-900 capitalize">{log.resource_action || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">IP Address</p>
              <p className="text-sm font-mono text-gray-900">{log.ip_address || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">User Agent</p>
              <p className="text-xs text-gray-600 truncate" title={log.user_agent}>{log.user_agent || 'N/A'}</p>
            </div>
          </div>

          {/* Admin Info */}
          <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Performed By</h3>
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-indigo-200 flex items-center justify-center">
                <User className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{log.reason || 'System Admin'}</p>
                <p className="text-xs text-gray-500 font-mono">{log.admin_id}</p>
              </div>
            </div>
          </div>

          {/* Resource Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Resource</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Type</dt>
                <dd className="text-sm text-gray-900 font-medium capitalize">{log.resource_type}</dd>
              </div>
              {log.resource_id && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Resource ID</dt>
                  <dd className="text-sm font-mono text-gray-900">{log.resource_id}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Before/After Data */}
          {log.before_data && Object.keys(log.before_data).length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
              <pre className="text-sm text-gray-600 bg-gray-100 p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(log.before_data, null, 2)}
              </pre>
            </div>
          )}

          {log.after_data && Object.keys(log.after_data).length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Changes</h3>
              <pre className="text-sm text-gray-600 bg-gray-100 p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(log.after_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Tamper-Proof Info */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start space-x-3">
              <Lock className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-green-800">Tamper-Proof Audit Trail</h3>
                <p className="text-xs text-green-700 mt-1">
                  This entry is cryptographically checksummed and cannot be modified or deleted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogsPage;

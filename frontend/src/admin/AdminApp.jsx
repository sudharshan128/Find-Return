/**
 * Admin Application Entry Point
 * Separate routing for admin panel
 * 
 * SECURITY HARDENED - Phase 2
 * - Error boundary for graceful error handling
 * - Session revocation support
 * - Audit integrity display
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Context
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';

// Layout
import AdminLayout from './components/AdminLayout';
import AdminErrorBoundary from './components/AdminErrorBoundary';

// Pages
import AdminLoginPage from './pages/AdminLoginPage';
import AdminAuthCallback from './pages/AdminAuthCallback';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminItemsPage from './pages/AdminItemsPage';
import AdminClaimsPage from './pages/AdminClaimsPage';
import AdminChatsPage from './pages/AdminChatsPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminNotificationsPage from './pages/AdminNotificationsPage';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, loading, initializing, hasPermission, adminProfile } = useAdminAuth();

  // CRITICAL FIX: Wait for auth initialization to complete
  // Use both 'loading' and 'initializing' flags
  if (loading || initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // After initialization is complete, check if authenticated
  if (!isAuthenticated) {
    console.log('[PROTECTED ROUTE] Not authenticated, redirecting to login');
    return <Navigate to="/admin/login" replace />;
  }

  // Check role permissions if required
  if (requiredRole && !hasPermission(requiredRole)) {
    console.log('[PROTECTED ROUTE] Missing required role:', requiredRole);
    return <Navigate to="/admin" replace />;
  }

  return children;
};

// Main Admin App Component
const AdminAppContent = () => {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10B981',
            },
          },
          error: {
            style: {
              background: '#EF4444',
            },
          },
        }}
      />
      
      <Routes>
        {/* Public Admin Routes */}
        <Route path="login" element={<AdminLoginPage />} />
        <Route path="auth/callback" element={<AdminAuthCallback />} />
        
        {/* Protected Admin Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="items" element={<AdminItemsPage />} />
          <Route path="claims" element={<AdminClaimsPage />} />
          <Route path="chats" element={<AdminChatsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

const AdminApp = () => {
  return (
    <AdminErrorBoundary>
      <AdminAuthProvider>
        <AdminAppContent />
      </AdminAuthProvider>
    </AdminErrorBoundary>
  );
};

export default AdminApp;

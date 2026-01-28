/**
 * Admin Module Index
 * Export all admin components for easy importing
 */

// Main App
export { default as AdminApp } from './AdminApp';

// Contexts
export { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';

// Layout
export { default as AdminLayout } from './components/AdminLayout';

// Pages
export { default as AdminLoginPage } from './pages/AdminLoginPage';
export { default as AdminDashboardPage } from './pages/AdminDashboardPage';
export { default as AdminUsersPage } from './pages/AdminUsersPage';
export { default as AdminItemsPage } from './pages/AdminItemsPage';
export { default as AdminClaimsPage } from './pages/AdminClaimsPage';
export { default as AdminChatsPage } from './pages/AdminChatsPage';
export { default as AdminReportsPage } from './pages/AdminReportsPage';
export { default as AdminAuditLogsPage } from './pages/AdminAuditLogsPage';
export { default as AdminSettingsPage } from './pages/AdminSettingsPage';

// API Layer
// Note: Do not re-export the full adminSupabase surface here — it contains
// privileged DB helpers. Import `adminAPIClient` or `adminAuth` explicitly where needed.

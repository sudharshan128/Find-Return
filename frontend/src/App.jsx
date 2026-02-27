/**
 * App.jsx
 * Root component with routing setup and auth provider.
 */

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './components/auth/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/layout/Layout';
import { Toaster } from 'react-hot-toast';

// Eagerly loaded — critical path (first render / auth redirect)
import AuthCallback from './pages/AuthCallback';
import MaintenancePage from './pages/MaintenancePage';

// Lazy-loaded pages — each downloads as its own small chunk
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage'));
const ReportFoundPage = lazy(() => import('./pages/ReportFoundPage'));
const UploadItemPage = lazy(() => import('./pages/UploadItemPage'));
const MyClaimsPage = lazy(() => import('./pages/MyClaimsPage'));
const MyItemsPage = lazy(() => import('./pages/MyItemsPage'));
const ItemClaimsPage = lazy(() => import('./pages/ItemClaimsPage'));
const ChatsListPage = lazy(() => import('./pages/ChatsListPage'));
const ChatPage = lazy(() => import('./pages/ChatPageNew'));
const BlockedUsersPage = lazy(() => import('./pages/BlockedUsersPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ImageUploadTestPage = lazy(() => import('./pages/ImageUploadTestPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

// Admin App — large bundle, isolated chunk
const AdminApp = lazy(() => import('./admin/AdminApp'));

// Minimal page-loading fallback (no layout flash)
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Maintenance check wrapper — only hits backend ONCE per session
function MaintenanceChecker({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Skip check for maintenance and admin pages
    if (location.pathname === '/maintenance' || location.pathname.startsWith('/admin')) {
      return;
    }

    // Only check once per browser session to avoid a backend round-trip on every navigation
    if (sessionStorage.getItem('maintenanceChecked')) return;

    const checkMaintenance = async () => {
      try {
        const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
        const response = await fetch(`${backendURL}/api/health`);
        sessionStorage.setItem('maintenanceChecked', '1');
        if (response.status === 503) {
          const data = await response.json();
          if (data.maintenance) {
            sessionStorage.setItem('maintenanceMessage', data.message || 'We are currently performing maintenance.');
            navigate('/maintenance', { replace: true });
          }
        }
      } catch (error) {
        // Backend unreachable — don't block the app
        sessionStorage.setItem('maintenanceChecked', '1');
        console.warn('Maintenance check failed:', error);
      }
    };

    checkMaintenance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally run only once on mount, not on every navigation

  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Toaster position="top-right" />
          <MaintenanceChecker>
            <Suspense fallback={<PageLoader />}>
            <Routes>
          {/* Public routes with layout */}
          <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route path="/items/:id" element={
              <ProtectedRoute>
                <ItemDetailPage />
              </ProtectedRoute>
            } />
            
            {/* Protected routes */}
            <Route
              path="/upload-item"
              element={
                <ProtectedRoute>
                  <UploadItemPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/report"
              element={
                <ProtectedRoute>
                  <ReportFoundPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-claims"
              element={
                <ProtectedRoute>
                  <MyClaimsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-items"
              element={
                <ProtectedRoute>
                  <MyItemsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/items/:id/claims"
              element={
                <ProtectedRoute>
                  <ItemClaimsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chats"
              element={
                <ProtectedRoute>
                  <ChatsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/blocked-users"
              element={
                <ProtectedRoute>
                  <BlockedUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-image-upload"
              element={
                <ProtectedRoute>
                  <ImageUploadTestPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* About page - public, with layout */}
          <Route path="/about" element={<AboutPage />} />

          {/* Chat page - fullscreen, NO layout wrapper */}
          <Route
            path="/chats/:id"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />

          {/* Admin routes - NOT wrapped in layout, uses separate AdminApp */}
          <Route
            path="/admin/*"
            element={<AdminApp />}
          />

          {/* Auth routes without layout */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Maintenance page - no layout */}
          <Route path="/maintenance" element={<MaintenancePage />} />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
            </Suspense>
          </MaintenanceChecker>
      </AuthProvider>
    </Router>
  </ErrorBoundary>
  );
}

export default App;

/**
 * App.jsx
 * Root component with routing setup and auth provider.
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './components/auth/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/layout/Layout';
import { Toaster } from 'react-hot-toast';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ItemDetailPage from './pages/ItemDetailPage';
import ReportFoundPage from './pages/ReportFoundPage';
import UploadItemPage from './pages/UploadItemPage';
import MyClaimsPage from './pages/MyClaimsPage';
import MyItemsPage from './pages/MyItemsPage';
import ItemClaimsPage from './pages/ItemClaimsPage';
import ChatsListPage from './pages/ChatsListPage';
import ChatPage from './pages/ChatPageNew';
import BlockedUsersPage from './pages/BlockedUsersPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import AuthCallback from './pages/AuthCallback';
import ImageUploadTestPage from './pages/ImageUploadTestPage';

// Admin App - uses its own routing
import AdminApp from './admin/AdminApp';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Toaster position="top-right" />
          <Routes>
          {/* Public routes with layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/items/:id" element={<ItemDetailPage />} />
            
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
              path="/chats/:id"
              element={
                <ProtectedRoute>
                  <ChatPage />
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
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  </ErrorBoundary>
  );
}

export default App;

/**
 * Admin Auth Callback Page
 * Handles OAuth redirect for admin panel login
 * Mirrors public AuthCallback.jsx but navigates to /admin instead of /
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const AdminAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAdminAuth();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [errorMessage, setErrorMessage] = useState('');

  console.log('[AUTH CALLBACK]', { loading, isAuthenticated, status });

  useEffect(() => {
    // Check for error in URL params
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.log('[AUTH CALLBACK] OAuth error:', error);
      setStatus('error');
      setErrorMessage(errorDescription || 'Authentication failed. Please try again.');
      return;
    }

    // Wait for auth state to settle
    const checkAuth = () => {
      console.log('[AUTH CALLBACK] Checking auth state - loading:', loading, 'authenticated:', isAuthenticated);
      if (!loading) {
        if (isAuthenticated) {
          console.log('[AUTH CALLBACK] Auth successful, redirecting to /admin');
          setStatus('success');
          // Redirect to ADMIN dashboard after showing success
          setTimeout(() => {
            navigate('/admin', { replace: true });
          }, 1500);
        } else {
          console.log('[AUTH CALLBACK] Auth not confirmed, waiting...');
          // Give a bit more time for auth to complete
          setTimeout(() => {
            if (!isAuthenticated) {
              console.log('[AUTH CALLBACK] Still not authenticated after delay, showing error');
              setStatus('error');
              setErrorMessage('Session could not be established. Please try signing in again.');
            }
          }, 3000);
        }
      }
    };

    checkAuth();
  }, [loading, isAuthenticated, navigate, searchParams]);

  // Auto-redirect on timeout for success
  useEffect(() => {
    if (status === 'processing') {
      const timeout = setTimeout(() => {
        if (status === 'processing') {
          navigate('/admin', { replace: true });
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {status === 'processing' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 mb-4">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Completing sign in...</h2>
            <p className="text-gray-400">Please wait while we verify your admin credentials.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600 mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome, Admin!</h2>
            <p className="text-gray-400">You are being redirected to the admin dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600 mb-4">
              <XCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Authentication Failed</h2>
            <p className="text-gray-400 mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate('/admin/login', { replace: true })}
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuthCallback;

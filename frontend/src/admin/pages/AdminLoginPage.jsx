/**
 * Admin Login Page
 * Isolated login page for admin panel - no links from public site
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useSettings } from '../../hooks/useSettings';
import { Shield, Lock, AlertCircle } from 'lucide-react';

const AdminLoginPage = () => {
  const { signInWithGoogle, isAuthenticated, loading, initializing, requires2FA } = useAdminAuth();
  const { platform_name } = useSettings();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  console.log('[LOGIN PAGE]', { initializing, isAuthenticated, loading, requires2FA });

  useEffect(() => {
    if (!initializing && isAuthenticated && !requires2FA) {
      console.log('[LOGIN PAGE] Already authenticated, redirecting to /admin');
      navigate('/admin');
    }
  }, [isAuthenticated, initializing, navigate, requires2FA]);

  const handleGoogleSignIn = async () => {
    try {
      console.log('[LOGIN PAGE] Starting Google sign in...');
      setError(null);
      setIsSigningIn(true);
      await signInWithGoogle();
      // Redirect will happen in auth context
    } catch (err) {
      console.error('[LOGIN PAGE] Sign in error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
      setIsSigningIn(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjIiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTAtMTZjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>

      <div className="relative w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-600 mb-4">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="text-gray-400 mt-2">{platform_name}</p>
        </div>

        {/* Login card */}
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <Lock className="h-8 w-8 text-indigo-400 mx-auto mb-2" />
            <h2 className="text-xl font-semibold text-white">Authorized Access Only</h2>
            <p className="text-gray-400 text-sm mt-1">
              Only pre-approved administrators can access this panel
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center text-red-300">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading || isSigningIn}
            className="w-full flex items-center justify-center px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || isSigningIn ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 mr-3"></div>
                Signing in...
              </>
            ) : (
              <>
                <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-xs">
              By signing in, you acknowledge that all actions are logged and monitored for security purposes.
            </p>
          </div>
        </div>

        {/* Security notice */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            🔒 Secure connection • Session monitored • All actions audited
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;

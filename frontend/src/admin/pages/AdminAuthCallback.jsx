/**
 * Admin Auth Callback Page
 * Handles OAuth redirect for admin panel login
 * STEP 2.3: Now includes 2FA verification if required
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { TwoFAVerification } from '../components/TwoFAVerification';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading, user, requires2FA, setRequires2FA } = useAdminAuth();
  const [status, setStatus] = useState('processing'); // processing, success, error, 2fa_required
  const [errorMessage, setErrorMessage] = useState('');
  const [checking2FA, setChecking2FA] = useState(false);

  console.log('[AUTH CALLBACK]', { loading, isAuthenticated, requires2FA, status });

  // Check if user requires 2FA after successful auth
  useEffect(() => {
    if (isAuthenticated && user && !requires2FA && !checking2FA) {
      // Check backend for 2FA requirement
      const check2FARequirement = async () => {
        try {
          setChecking2FA(true);
          const token = localStorage.getItem('supabase.auth.token');
          if (!token) return;

          const response = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/admin/auth/profile`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const data = await response.json();

          if (data.requires_2fa) {
            // User requires 2FA - show verification screen
            setRequires2FA(true);
            setStatus('2fa_required');
          } else {
            // No 2FA required, complete login
            setStatus('success');
            setTimeout(() => {
              navigate('/admin', { replace: true });
            }, 1500);
          }
        } catch (error) {
          console.error('[AUTH CALLBACK] Error checking 2FA:', error);
          // Proceed without 2FA check
          setStatus('success');
          setTimeout(() => {
            navigate('/admin', { replace: true });
          }, 1500);
        } finally {
          setChecking2FA(false);
        }
      };

      check2FARequirement();
    }
  }, [isAuthenticated, user, requires2FA, checking2FA, setRequires2FA, navigate]);

  // Show 2FA verification if required
  if (requires2FA) {
    return (
      <TwoFAVerification
        onSuccess={() => {
          setRequires2FA(false);
          toast.success('2FA verified! Logging in...');
          navigate('/admin', { replace: true });
        }}
        onCancel={() => {
          setRequires2FA(false);
          navigate('/admin/login', { replace: true });
        }}
      />
    );
  }

  // Check for error in URL params
  useEffect(() => {
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.log('[AUTH CALLBACK] OAuth error:', error);
      setStatus('error');
      setErrorMessage(errorDescription || 'Authentication failed. Please try again.');
      return;
    }
  }, [searchParams]);

  // Auto-redirect on timeout for success
  useEffect(() => {
    if (status === 'processing') {
      const timeout = setTimeout(() => {
        if (status === 'processing' && isAuthenticated) {
          navigate('/admin', { replace: true });
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [status, isAuthenticated, navigate]);

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

        {status === '2fa_required' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-600 mb-4">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Waiting for 2FA...</h2>
            <p className="text-gray-400">Please complete 2FA verification below.</p>
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


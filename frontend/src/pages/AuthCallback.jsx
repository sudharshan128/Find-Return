/**
 * Auth Callback Page
 * Handles OAuth redirect with loading state and error handling
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, Loader2, MapPin } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Check for error in URL params
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setErrorMessage(errorDescription || 'Authentication failed. Please try again.');
      return;
    }

    // Wait for auth state to settle
    const checkAuth = () => {
      if (!loading) {
        if (isAuthenticated) {
          setStatus('success');
          // Redirect after showing success
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 1500);
        } else {
          // Give a bit more time for auth to complete
          setTimeout(() => {
            if (!isAuthenticated) {
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
          navigate('/', { replace: true });
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-primary-50/40 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-10 text-center">
          {/* Logo */}
          <div className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Lost & Found</span>
          </div>

          {/* Processing State */}
          {status === 'processing' && (
            <div className="animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Completing Sign In
              </h2>
              <p className="text-gray-500">
                Please wait while we set up your account...
              </p>
              <div className="mt-6 flex justify-center gap-1">
                <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Welcome!
              </h2>
              <p className="text-gray-500">
                Sign in successful. Redirecting you now...
              </p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Sign In Failed
              </h2>
              <p className="text-gray-500 mb-6">
                {errorMessage}
              </p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Help Link */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Having trouble?{' '}
          <a 
            href="mailto:support@lostfound.bangalore" 
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;

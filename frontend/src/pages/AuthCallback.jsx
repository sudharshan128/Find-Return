/**
 * Auth Callback Page
 * Handles OAuth redirect with loading state and error handling
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { CheckCircle, XCircle, MapPin } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, initializing } = useAuth();
  const { platform_name, contact_email } = useSettings();
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
      if (!initializing) {
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
  }, [initializing, isAuthenticated, navigate, searchParams]);

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
    <div className="bg-surface min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
          <div className="card p-10 text-center">
          {/* Logo */}
          <div className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-ink">{platform_name}</span>
          </div>

          {/* Processing State */}
          {status === 'processing' && (
            <div className="animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary-50 flex items-center justify-center">
                <div className="w-8 h-8 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
              <h2 className="card-title">
                Completing Sign In
              </h2>
              <p className="body-text">
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
              <h2 className="card-title">
                Welcome!
              </h2>
              <p className="body-text">
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
              <h2 className="card-title">
                Sign In Failed
              </h2>
              <p className="body-text mb-6">
                {errorMessage}
              </p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="btn btn-primary"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Help Link */}
        <p className="mt-6 text-center caption">
          Having trouble?{' '}
          <a 
            href={`mailto:${contact_email}`} 
            className="link"
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;

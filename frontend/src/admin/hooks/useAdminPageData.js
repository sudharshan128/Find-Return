/**
 * Custom hook for admin pages to safely fetch data
 * Ensures:
 * - Auth is complete before fetching
 * - adminProfile is available
 * - Loading states are properly managed
 * - Errors have fallback UI
 */

import { useEffect, useState, useRef } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export const useAdminPageData = (fetchFn, dependencies = []) => {
  const { isAuthenticated, adminProfile, loading: authLoading } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const refetch = async () => {
    // Prevent fetching if auth isn't complete
    if (authLoading || !isAuthenticated || !adminProfile) {
      console.warn('[Admin Data] Skipping fetch - auth not ready', { 
        authLoading, 
        isAuthenticated, 
        hasProfile: !!adminProfile 
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const result = await fetchFn({ signal: abortControllerRef.current.signal });
      
      setData(result);
    } catch (err) {
      // Only set error if not aborted
      if (err.name !== 'AbortError') {
        console.error('[Admin Data] Fetch error:', err);
        setError(err.message || 'Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  // Only fetch when auth is ready
  useEffect(() => {
    if (!authLoading && isAuthenticated && adminProfile) {
      refetch();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [authLoading, isAuthenticated, adminProfile?.id, ...dependencies]);

  return { data, loading, error, refetch };
};

export const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
      <p className="mt-4 text-gray-500">Loading...</p>
    </div>
  </div>
);

export const ErrorFallback = ({ error, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
    <div className="flex items-start">
      <div className="flex-shrink-0">
        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
        <div className="mt-2 text-sm text-red-700">
          <p>{error}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  </div>
);

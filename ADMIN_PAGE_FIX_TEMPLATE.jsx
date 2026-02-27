/**
 * TEMPLATE: How to Fix Any Admin Page (Copy-Paste Ready)
 * This template shows the correct pattern for all admin pages
 * Fixes blank pages, infinite loading, and premature fetching
 */

import { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { LoadingSpinner, ErrorFallback } from '../hooks/useAdminPageData';
import toast from 'react-hot-toast';

const AdminExamplePage = () => {
  // ✅ STEP 1: Import auth context with loading state
  const { 
    adminProfile,          // ← Check if admin
    isAuthenticated,       // ← Check if logged in
    loading: authLoading,  // ← Check if auth complete
    isSuperAdmin,          // ← Check permissions
  } = useAdminAuth();

  // ✅ STEP 2: Declare all state at top
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ STEP 3: Create fetchData function with proper error handling
  const fetchData = async (isRefresh = false) => {
    try {
      // Reset error state
      setError(null);
      
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Actually fetch from API
      // Example: const result = await adminAPI.getData();
      // For this template, just wait to simulate API call
      const result = await new Promise(resolve => 
        setTimeout(() => resolve({ example: 'data' }), 1000)
      );

      setData(result);
      
      if (isRefresh) {
        toast.success('Data refreshed');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
      toast.error(err.message || 'Failed to load data');
    } finally {
      // CRITICAL: Always reset loading states
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ✅ STEP 4: useEffect with proper dependencies
  // DON'T fetch on mount - wait for auth to complete first!
  useEffect(() => {
    // Only fetch when ALL conditions are met:
    // 1. Auth loading is DONE (not authLoading)
    // 2. User IS authenticated (isAuthenticated)
    // 3. Admin profile EXISTS (adminProfile)
    if (!authLoading && isAuthenticated && adminProfile) {
      fetchData();
    } else if (!authLoading && !isAuthenticated) {
      // Auth is done, but user is not logged in
      setLoading(false);
    }
  }, [
    authLoading,              // Re-check when auth loading completes
    isAuthenticated,          // Re-check if auth status changes
    adminProfile?.id,         // Re-check when admin profile changes
    // DON'T include: adminProfile (object reference changes)
    // DON'T include: navigate
    // DON'T include: functions without useCallback
  ]);

  // ✅ STEP 5: Handle loading state
  if (loading) {
    return <LoadingSpinner />;
  }

  // ✅ STEP 6: Handle error state
  if (error) {
    return (
      <ErrorFallback 
        error={error} 
        onRetry={() => fetchData(true)}
      />
    );
  }

  // ✅ STEP 7: Render page content
  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Example Page
        </h1>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Page content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Use data here */}
        {data ? (
          <p>Data loaded: {JSON.stringify(data)}</p>
        ) : (
          <p>No data</p>
        )}
      </div>
    </div>
  );
};

export default AdminExamplePage;

/**
 * ============================================================
 * APPLYING THIS TEMPLATE
 * ============================================================
 * 
 * To fix any admin page, follow this checklist:
 * 
 * □ 1. Import: useAdminAuth with all 3 states
 *      const { adminProfile, isAuthenticated, loading: authLoading } = useAdminAuth();
 * 
 * □ 2. State: Declare loading, error, data states
 *      const [loading, setLoading] = useState(true);
 *      const [error, setError] = useState(null);
 *      const [data, setData] = useState(null);
 * 
 * □ 3. Fetch: Create async fetchData function
 *      - Use try/catch
 *      - Set error state in catch
 *      - Reset loading in finally
 * 
 * □ 4. Effect: ONLY fetch when auth ready
 *      if (!authLoading && isAuthenticated && adminProfile) {
 *        fetchData();
 *      }
 * 
 * □ 5. Dependencies: ONLY [authLoading, isAuthenticated, adminProfile?.id, ...]
 *      DON'T include navigate, functions, or full objects
 * 
 * □ 6. Loading: Show spinner if (loading)
 * 
 * □ 7. Error: Show ErrorFallback if (error)
 * 
 * □ 8. Data: Render content, use data.field safely
 * 
 * ============================================================
 * COMMON MISTAKES TO AVOID
 * ============================================================
 * 
 * ❌ WRONG: useEffect(() => { fetchData(); }, [])
 *    (Fetches before auth is ready → silent 403 failure)
 *    
 * ✅ RIGHT: useEffect(() => { 
 *     if (!authLoading && isAuthenticated && adminProfile) {
 *       fetchData();
 *     }
 *   }, [authLoading, isAuthenticated, adminProfile?.id])
 * 
 * 
 * ❌ WRONG: const [loading, setLoading] = useState(true);
 *          if (loading) return null;
 *    (Blank page if loading is true)
 *    
 * ✅ RIGHT: if (loading) return <LoadingSpinner />;
 *          if (error) return <ErrorFallback />;
 *          return <PageContent />;
 * 
 * 
 * ❌ WRONG: fetch().then(setData).catch(console.error)
 *    (No error state, no finally, loading never resets)
 *    
 * ✅ RIGHT: try {
 *             setLoading(true);
 *             const result = await fetch();
 *             setData(result);
 *           } catch (err) {
 *             setError(err.message);
 *           } finally {
 *             setLoading(false);
 *           }
 * 
 * 
 * ❌ WRONG: const [adminProfile] = useAdminAuth();
 *          useEffect(() => { ... }, [adminProfile])
 *    (Object reference changes on every render → infinite loops)
 *    
 * ✅ RIGHT: const { adminProfile } = useAdminAuth();
 *          useEffect(() => { ... }, [adminProfile?.id])
 *          (Use .id or primitive, not object)
 * 
 * 
 * ============================================================
 * REFERENCE IMPLEMENTATIONS
 * ============================================================
 * 
 * ✅ AdminDashboardPage.jsx - Dashboard with stats
 *    Features: Multiple parallel fetches, charts, refresh
 * 
 * ✅ AdminUsersPage.jsx - Table with pagination
 *    Features: Search, filter, pagination, modals
 * 
 * ✅ AdminItemsPage.jsx - Table with moderation
 *    Features: Status filter, bulk actions, images
 * 
 * Use these as templates when creating new admin pages.
 * All follow this same pattern: auth check → fetch → render
 * 
 */

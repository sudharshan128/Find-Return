/**
 * Home Page
 * Browse and search for lost items
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import ItemGrid from '../components/items/ItemGrid';
import ItemFilters from '../components/items/ItemFilters';
import { ChevronLeft, ChevronRight, Plus, Search as SearchIcon, Shield, MessageCircle, Star, AlertTriangle } from 'lucide-react';

const ITEMS_PER_PAGE = 12;

const HomePage = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: 'unclaimed' });
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch items - wait for auth to be ready
  useEffect(() => {
    // CRITICAL: Don't fetch until auth is initialized
    if (authLoading) {
      console.log('[HOME] Waiting for auth to initialize...');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const doFetch = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('[HOME] Fetching items with filters:', filters);
        const result = await db.items.search({
          ...filters,
          offset: page * ITEMS_PER_PAGE,
          limit: ITEMS_PER_PAGE,
        });
        
        if (!cancelled) {
          console.log('[HOME] Items fetched:', result?.data?.length);
          // Ensure images are included in the response
          if (result?.data) {
            console.log('[HOME] First item sample:', {
              id: result.data[0]?.id,
              title: result.data[0]?.title,
              images: result.data[0]?.images,
            });
          }
          setItems(result?.data || []);
          setTotalCount(result?.count || 0);
          setError(null);
        }
      } catch (err) {
        console.error('[HOME] Fetch error:', err);
        if (!cancelled) {
          const errorMsg = err.message || 'Failed to load items';
          console.log('[HOME] Setting error:', errorMsg);
          
          // Distinguish between database setup issue and network issue
          if (errorMsg.includes('relation') || errorMsg.includes('does not exist')) {
            setError('database');
          } else if (errorMsg.includes('Connection') || errorMsg.includes('network')) {
            setError('network');
          } else {
            setError('fetch');
          }
          
          setItems([]);
          setTotalCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    doFetch();
    return () => { cancelled = true; };
  }, [filters, page, authLoading]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(0);
  };

  const handleSearch = (searchTerm) => {
    setFilters((prev) => ({ ...prev, search: searchTerm }));
    setPage(0);
  };

  // Retry function for errors
  const handleRetry = () => {
    setFilters({ ...filters }); // Trigger re-fetch
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Database not ready banner
  const DatabaseSetupBanner = () => (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-800 mb-1">Database Setup Required</h3>
          <p className="text-amber-700 text-sm mb-3">
            The database tables haven't been created yet. Please run the SQL migration in Supabase SQL Editor.
          </p>
          <ol className="text-sm text-amber-700 list-decimal list-inside space-y-1">
            <li>Go to your Supabase Dashboard → SQL Editor</li>
            <li>Copy the contents from <code className="bg-amber-100 px-1 rounded">supabase/migrations/000_fresh_setup.sql</code></li>
            <li>Paste and click "Run"</li>
            <li>Refresh this page</li>
          </ol>
        </div>
      </div>
    </div>
  );

  // Error banner component
  const ErrorBanner = ({ type }) => {
    if (type === 'timeout') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 mb-1">Request Timeout</h3>
              <p className="text-red-700 text-sm mb-3">The request took too long. Please try again.</p>
              <button onClick={handleRetry} className="btn btn-primary">Retry</button>
            </div>
          </div>
        </div>
      );
    }
    if (type === 'database') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 mb-1">Database Setup Required</h3>
              <p className="text-amber-700 text-sm mb-3">
                The database tables haven't been created yet. Please run the SQL migration in Supabase SQL Editor.
              </p>
              <ol className="text-sm text-amber-700 list-decimal list-inside space-y-1">
                <li>Go to your Supabase Dashboard → SQL Editor</li>
                <li>Run <code className="bg-amber-100 px-1 rounded">supabase/schema.sql</code></li>
                <li>Then run <code className="bg-amber-100 px-1 rounded">supabase/storage_policies.sql</code></li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
        </div>
      );
    }
    if (type === 'network') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 mb-1">Network Error</h3>
              <p className="text-red-700 text-sm mb-3">Unable to connect to the server. Please check your internet connection.</p>
              <button onClick={handleRetry} className="btn btn-primary">Retry</button>
            </div>
          </div>
        </div>
      );
    }
    if (type === 'fetch') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 mb-1">Failed to Load Items</h3>
              <p className="text-red-700 text-sm mb-3">Something went wrong while loading items. Please try again.</p>
              <button onClick={handleRetry} className="btn btn-primary">Retry</button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Show loading state while auth is initializing */}
      {authLoading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading items...</p>
          </div>
        </div>
      )}
      
      {!authLoading && (
        <>
          {/* Hero Section */}
          <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Find Your Lost Items in Bangalore
            </h1>
            <p className="text-lg text-primary-100 mb-8">
              Browse through items found across the city. Our community helps reunite 
              lost items with their rightful owners through secure verification.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {isAuthenticated ? (
                <Link 
                  to="/upload-item" 
                  className="btn bg-white text-primary-700 hover:bg-primary-50 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  <Plus className="w-6 h-6 mr-2" />
                  Upload Found Product
                </Link>
              ) : (
                <Link 
                  to="/login" 
                  state={{ from: '/upload-item' }}
                  className="btn bg-white text-primary-700 hover:bg-primary-50 px-8 py-4 text-lg font-semibold shadow-lg"
                >
                  Sign In to Upload
                </Link>
              )}
              <a href="#browse" className="btn border-2 border-white text-white hover:bg-white/10 px-6 py-3">
                <SearchIcon className="w-5 h-5 mr-2" />
                Browse Items
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 bg-white border-b">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary-600">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Finder Posts Item</h3>
              <p className="text-sm text-gray-600">Found something? Post it with photos and location details.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-secondary-600">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Owner Claims Item</h3>
              <p className="text-sm text-gray-600">Prove ownership by answering verification questions.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-accent-600">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Secure Return</h3>
              <p className="text-sm text-gray-600">Chat safely and coordinate the return through our platform.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Browse Items Section */}
      <section id="browse" className="py-8">
        <div className="container mx-auto px-4">
          {/* Database Setup Warning */}
          {error === 'database' && <DatabaseSetupBanner />}
          
          {/* Network/Fetch Errors */}
          {(error === 'timeout' || error === 'fetch' || error === 'network') && <ErrorBanner type={error} />}
          
          {/* Filters */}
          <ItemFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onSearch={handleSearch}
          />

          {/* Results count */}
          {!loading && !error && (
            <div className="mb-4 text-sm text-gray-500">
              Showing {items.length} of {totalCount} items
            </div>
          )}

          {/* Items Grid */}
          <ItemGrid items={items} loading={loading} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn btn-secondary disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-1 px-4">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i;
                  } else if (page < 3) {
                    pageNum = i;
                  } else if (page > totalPages - 4) {
                    pageNum = totalPages - 5 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn btn-secondary disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Why Use Our Platform?</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <Shield className="w-10 h-10 text-primary-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Zero Data Exposure</h3>
              <p className="text-sm text-gray-600">No phone numbers or addresses are shared. All communication is masked.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <MessageCircle className="w-10 h-10 text-secondary-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Verified Claims</h3>
              <p className="text-sm text-gray-600">Claimants must prove ownership before chatting with finders.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <Star className="w-10 h-10 text-accent-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Trust Scores</h3>
              <p className="text-sm text-gray-600">Build reputation through successful returns. Low trust users are reviewed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Action Button for Upload - Only visible to authenticated users */}
      {isAuthenticated && (
        <Link
          to="/upload-item"
          className="fixed bottom-6 right-6 z-50 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-110 flex items-center gap-2 group"
          title="Upload Found Product"
        >
          <Plus className="w-6 h-6" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-medium">
            Upload Found Product
          </span>
        </Link>
      )}
        </>
      )}
    </div>
  );
};

export default HomePage;

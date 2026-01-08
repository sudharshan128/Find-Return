/**
 * My Claims Page
 * View user's submitted claims
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, getImageUrl } from '../lib/supabase';
import { Clock, Check, X, MessageCircle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const MyClaimsPage = () => {
  const { user, initializing } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    // Wait for auth to initialize
    if (initializing) return;
    
    // Guard: no user means not logged in
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchClaims = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Timeout safety: 15 seconds
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 15000);

        const data = await db.claims.getByUser(user.id);
        
        clearTimeout(timeoutId);
        
        if (isMounted) {
          setClaims(data || []);
        }
      } catch (error) {
        console.error('Error fetching claims:', error);
        if (isMounted) {
          setError(error.message || 'Failed to load claims');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchClaims();

    return () => {
      isMounted = false;
    };
  }, [user?.id, initializing]);

  const filteredClaims = claims.filter((claim) => {
    if (filter === 'all') return true;
    return claim.status === filter;
  });

  const statusIcons = {
    pending: <Clock className="w-5 h-5 text-yellow-500" />,
    approved: <Check className="w-5 h-5 text-green-500" />,
    rejected: <X className="w-5 h-5 text-red-500" />,
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  // Show loading only if actually loading
  if (loading || initializing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-6">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="card text-center py-12">
            <div className="text-red-500 mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load claims</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Claims</h1>
        <p className="text-gray-600 mb-6">Track the status of your ownership claims</p>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-2">
                  ({claims.filter((c) => c.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Claims List */}
        {filteredClaims.length === 0 ? (
          <div className="card text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <MessageCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {filter === 'all' ? 'No claims yet' : `No ${filter} claims`}
            </h3>
            <p className="text-gray-500 mb-4">
              {filter === 'all' 
                ? 'When you claim an item, it will appear here'
                : 'Try selecting a different filter'}
            </p>
            <Link to="/" className="btn btn-primary">
              Browse Items
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClaims.map((claim) => {
              const primaryImage = claim.item?.images?.find((i) => i.is_primary) || claim.item?.images?.[0];
              
              return (
                <div key={claim.id} className="card hover:shadow-card-hover transition-shadow">
                  <div className="flex gap-4">
                    {/* Item Image */}
                    {primaryImage && (
                      <Link to={`/items/${claim.item_id}`} className="flex-shrink-0">
                        <img
                          src={getImageUrl(primaryImage)}
                          alt={claim.item?.title}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      </Link>
                    )}

                    {/* Claim Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link 
                          to={`/items/${claim.item_id}`}
                          className="font-semibold text-gray-900 hover:text-primary-600 truncate"
                        >
                          {claim.item?.title || 'Item'}
                        </Link>
                        <span className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full ${statusColors[claim.status]}`}>
                          {claim.status}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 mb-3">
                        Claimed {formatDistanceToNow(new Date(claim.created_at), { addSuffix: true })}
                      </p>

                      {/* Actions based on status */}
                      {claim.status === 'approved' && (
                        <Link
                          to="/chats"
                          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Chat with finder
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}

                      {claim.status === 'pending' && (
                        <p className="text-sm text-yellow-700 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Waiting for finder to review
                        </p>
                      )}

                      {claim.status === 'rejected' && (
                        <p className="text-sm text-red-700">
                          Your claim was not approved by the finder
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyClaimsPage;

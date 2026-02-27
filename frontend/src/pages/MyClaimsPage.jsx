/**
 * My Claims Page
 * View user's submitted claims
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, getImageUrl } from '../lib/supabase';
import { Clock, CheckCircle2, XCircle, MessageCircle, ChevronRight, Package, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const MyClaimsPage = () => {
  const { user, initializing } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    // Wait for auth to initialize
    if (initializing) {
      console.log('[MY CLAIMS] Waiting for auth to initialize...');
      return;
    }
    
    // Guard: no user means not logged in
    if (!user?.id) {
      console.log('[MY CLAIMS] No user, setting loading to false');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchClaims = async () => {
      try {
        console.log('[MY CLAIMS] Fetching claims for user:', user.id);
        setLoading(true);
        setError(null);
        
        // Timeout safety: 15 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn('[MY CLAIMS] Fetch timeout');
          controller.abort();
        }, 15000);

        const data = await db.claims.getByUser(user.id);
        
        clearTimeout(timeoutId);
        
        if (isMounted) {
          console.log('[MY CLAIMS] Claims fetched:', data?.length || 0);
          setClaims(data || []);
          setError(null);
        }
      } catch (error) {
        console.error('[MY CLAIMS] Error fetching claims:', error);
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

  const statusConfig = {
    pending:  { icon: <Clock className="w-4 h-4" />,         label: 'Pending',  pill: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',   bar: 'bg-amber-400' },
    approved: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Approved', pill: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200', bar: 'bg-emerald-500' },
    rejected: { icon: <XCircle className="w-4 h-4" />,      label: 'Rejected', pill: 'bg-red-100 text-red-600 ring-1 ring-red-200',             bar: 'bg-red-400' },
  };

  if (loading || initializing) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container-app py-12">
          <div className="max-w-3xl mx-auto">
            <div className="h-8 bg-slate-200 rounded-xl w-40 mb-3 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded-lg w-64 mb-10 animate-pulse" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
                  <div className="flex gap-5">
                    <div className="w-20 h-20 rounded-xl bg-slate-100 flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="h-5 bg-slate-100 rounded-lg w-1/2" />
                      <div className="h-4 bg-slate-100 rounded-lg w-1/3" />
                      <div className="h-4 bg-slate-100 rounded-lg w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-10 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Failed to load claims</h2>
          <p className="text-sm text-slate-500 mb-5">{error}</p>
          <button onClick={() => window.location.reload()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalByStatus = (s) => claims.filter((c) => c.status === s).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container-app py-12">
        <div className="max-w-3xl mx-auto">

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 mb-1">My Claims</h1>
            <p className="text-slate-500">Track the status of your ownership claims</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Pending',  count: totalByStatus('pending'),  color: 'text-amber-600',   bg: 'bg-amber-50',   ring: 'ring-amber-100' },
              { label: 'Approved', count: totalByStatus('approved'), color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
              { label: 'Rejected', count: totalByStatus('rejected'), color: 'text-red-500',     bg: 'bg-red-50',     ring: 'ring-red-100' },
            ].map(({ label, count, color, bg, ring }) => (
              <div key={label} className={`${bg} ring-1 ${ring} rounded-2xl p-4 text-center`}>
                <p className={`text-2xl font-black ${color}`}>{count}</p>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  filter === status
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    filter === status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {totalByStatus(status)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Claims List */}
          {filteredClaims.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-2xl mb-4 ring-1 ring-slate-100">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">
                {filter === 'all' ? 'No claims yet' : `No ${filter} claims`}
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                {filter === 'all'
                  ? 'Browse items and submit a claim to get started'
                  : 'Try a different filter tab above'}
              </p>
              {filter === 'all' && (
                <Link to="/"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700
                                 text-white text-sm font-semibold rounded-xl transition-colors">
                  Browse Items <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClaims.map((claim) => {
                const primaryImage = claim.item?.images?.find((i) => i.is_primary) || claim.item?.images?.[0];
                const cfg = statusConfig[claim.status] || statusConfig.pending;

                return (
                  <div key={claim.id}
                       className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                                  hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                    {/* Colored top accent bar */}
                    <div className={`h-1 w-full ${cfg.bar}`} />

                    <div className="p-6 flex gap-5">
                      {/* Item image */}
                      <Link to={`/items/${claim.item_id}`} className="flex-shrink-0">
                        {primaryImage ? (
                          <img
                            src={getImageUrl(primaryImage)}
                            alt={claim.item?.title}
                            className="w-20 h-20 object-cover rounded-xl ring-1 ring-slate-100
                                       group-hover:ring-blue-200 transition-all"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-slate-100 ring-1 ring-slate-100
                                          flex items-center justify-center">
                            <Package className="w-7 h-7 text-slate-300" />
                          </div>
                        )}
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <Link
                            to={`/items/${claim.item_id}`}
                            className="text-base font-bold text-slate-800 hover:text-blue-600 transition-colors truncate"
                          >
                            {claim.item?.title || 'Unknown Item'}
                          </Link>
                          <span className={`inline-flex items-center gap-1 pl-2 pr-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${cfg.pill}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </div>

                        <p className="text-sm text-slate-400 mb-4">
                          Claimed {formatDistanceToNow(new Date(claim.created_at), { addSuffix: true })}
                        </p>

                        {claim.status === 'approved' && (
                          <Link to="/chats"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100
                                           text-emerald-700 text-sm font-semibold rounded-xl transition-colors ring-1 ring-emerald-200">
                            <MessageCircle className="w-4 h-4" />
                            Chat with finder
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        )}

                        {claim.status === 'pending' && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50
                                          text-amber-700 text-sm font-medium rounded-xl ring-1 ring-amber-200">
                            <Clock className="w-4 h-4" />
                            Waiting for finder to review
                          </div>
                        )}

                        {claim.status === 'rejected' && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50
                                          text-red-600 text-sm font-medium rounded-xl ring-1 ring-red-200">
                            <XCircle className="w-4 h-4" />
                            Claim was not approved by the finder
                          </div>
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
    </div>
  );
};

export default MyClaimsPage;

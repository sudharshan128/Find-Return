/**
 * HomePage â€” Browse & search lost items
 * Professional redesign: navy hero, clean browse section, trust features
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import ItemGrid from '../components/items/ItemGrid';
import ItemFilters from '../components/items/ItemFilters';
import {
  ChevronLeft, ChevronRight, Plus, Search as SearchIcon,
  Shield, MessageCircle, Star, AlertTriangle,
  CheckCircle2, Upload, PackageSearch,
} from 'lucide-react';

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
      setLoading(false);
      return;
    }

    let cancelled = false;

    const doFetch = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await db.items.search({
          ...filters,
          offset: page * ITEMS_PER_PAGE,
          limit: ITEMS_PER_PAGE,
        });
        
        if (!cancelled) {
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
    <div className="min-h-screen bg-slate-50">

      {/* Auth loading splash */}
      {authLoading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      )}

      {!authLoading && (
        <>
          {/* HERO */}
          <section
            className="relative overflow-hidden text-white"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)' }}
          >
            {/* Decorative blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-20"
                   style={{ background: 'radial-gradient(circle, #60a5fa, transparent 70%)' }} />
              <div className="absolute bottom-0 left-1/3 w-[360px] h-[360px] rounded-full opacity-10"
                   style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />
              <div className="absolute inset-0 opacity-[0.04]"
                   style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            <div className="relative container-app py-10 md:py-14">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20
                                bg-white/10 backdrop-blur-sm text-sm font-medium text-blue-200 mb-7">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Live in Bangalore
                </div>

                <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6">
                  Reuniting Lost Items
                  <br />
                  <span className="text-transparent bg-clip-text"
                        style={{ backgroundImage: 'linear-gradient(90deg, #93c5fd, #a5b4fc)' }}>
                    With Their Owners.
                  </span>
                </h1>

                <p className="text-blue-200 text-lg leading-relaxed mb-10 max-w-lg">
                  Found something? Post it. Lost something? Browse &amp; claim it.
                  Secure, verified, and community-driven.
                </p>

                <div className="flex flex-wrap gap-3 mb-12">
                  <Link
                    to={isAuthenticated ? '/upload-item' : '/login'}
                    state={!isAuthenticated ? { from: '/upload-item' } : undefined}
                    className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-primary-800
                               font-bold rounded-xl shadow-lg hover:bg-blue-50 hover:shadow-xl
                               transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <Upload className="w-5 h-5" />
                    Post Found Item
                  </Link>
                  <a
                    href="#browse"
                    className="inline-flex items-center gap-2 px-7 py-3.5 border-2 border-white/30
                               text-white font-semibold rounded-xl hover:bg-white/10 hover:border-white/50
                               transition-all duration-200"
                  >
                    <SearchIcon className="w-5 h-5" />
                    Browse Items
                  </a>
                </div>

                <div className="flex flex-wrap gap-3">
                  {[
                    { icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, text: 'Ownership verified' },
                    { icon: <Shield className="w-4 h-4 text-blue-300" />,        text: 'No data exposed' },
                    { icon: <Star className="w-4 h-4 text-yellow-400" />,        text: 'Trust-scored users' },
                  ].map(({ icon, text }) => (
                    <span key={text}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                     bg-white/10 border border-white/15 text-blue-100 text-sm">
                      {icon} {text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className="bg-white border-b border-slate-100">
            <div className="container-app py-14">
              <div className="text-center mb-10">
                <p className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase mb-2">How it works</p>
                <h2 className="text-2xl font-bold text-slate-800">Three steps to a reunion</h2>
              </div>
              <div className="relative grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="hidden md:block absolute top-10 left-[calc(16.666%+1.5rem)] right-[calc(16.666%+1.5rem)]
                                h-px border-t-2 border-dashed border-blue-100" />
                {[
                  { step: '01', icon: <Upload className="w-6 h-6 text-blue-600" />,        title: 'Finder Posts Item', desc: 'Upload photos and location details right from your phone.' },
                  { step: '02', icon: <PackageSearch className="w-6 h-6 text-blue-600" />,  title: 'Owner Claims It',   desc: "Prove ownership by answering the finder's verification questions." },
                  { step: '03', icon: <CheckCircle2 className="w-6 h-6 text-blue-600" />,   title: 'Secure Return',     desc: 'Chat safely and coordinate the handover — no personal data shared.' },
                ].map(({ step, icon, title, desc }) => (
                  <div key={step} className="relative flex flex-col items-center text-center px-4">
                    <div className="relative z-10 w-20 h-20 rounded-2xl bg-blue-50 border border-blue-100
                                    flex items-center justify-center mb-4 shadow-sm">
                      {icon}
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white
                                       text-xs font-bold flex items-center justify-center shadow">
                        {step}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1.5">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* BROWSE ITEMS */}
          <section id="browse" className="container-app py-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Browse Items</h2>
                {!loading && !error && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {totalCount} item{totalCount !== 1 ? 's' : ''} available
                  </p>
                )}
              </div>
              {isAuthenticated && (
                <Link to="/upload-item"
                      className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
                                 text-white text-sm font-bold rounded-xl shadow-sm transition-all hover:-translate-y-0.5">
                  <Plus className="w-4 h-4" />
                  Post Item
                </Link>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">
                    {error === 'network' ? 'Network Error' : 'Failed to Load Items'}
                  </p>
                  <p className="text-red-600 text-sm mt-0.5">
                    {error === 'network' ? 'Check your internet connection.' : 'Something went wrong. Please try again.'}
                  </p>
                  <button onClick={handleRetry}
                          className="mt-3 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    Retry
                  </button>
                </div>
              </div>
            )}

            <ItemFilters filters={filters} onFilterChange={handleFilterChange} onSearch={handleSearch} />
            <ItemGrid items={items} loading={loading} />

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200
                             text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let p;
                    if (totalPages <= 5) p = i;
                    else if (page < 3) p = i;
                    else if (page > totalPages - 4) p = totalPages - 5 + i;
                    else p = page - 2 + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all
                          ${page === p ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                        {p + 1}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200
                             text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </section>

          {/* WHY US */}
          <section className="bg-white border-t border-slate-100 mt-6">
            <div className="container-app py-16">
              <div className="text-center mb-10">
                <p className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase mb-2">Why Find &amp; Return</p>
                <h2 className="text-2xl font-bold text-slate-800">Built for trust, privacy &amp; simplicity</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {[
                  {
                    icon: <Shield className="w-7 h-7 text-blue-600" />,
                    gradient: 'from-blue-50 to-indigo-50',
                    ring: 'ring-blue-100',
                    title: 'Zero Data Exposure',
                    desc: 'No phone numbers or addresses ever shared. All communication is fully masked.',
                  },
                  {
                    icon: <MessageCircle className="w-7 h-7 text-violet-600" />,
                    gradient: 'from-violet-50 to-purple-50',
                    ring: 'ring-violet-100',
                    title: 'Verified Claims',
                    desc: 'Claimants must answer proof-of-ownership questions before chatting.',
                  },
                  {
                    icon: <Star className="w-7 h-7 text-amber-500" />,
                    gradient: 'from-amber-50 to-yellow-50',
                    ring: 'ring-amber-100',
                    title: 'Trust Score System',
                    desc: 'Build reputation through successful returns. Bad actors face extra scrutiny.',
                  },
                ].map(({ icon, gradient, ring, title, desc }) => (
                  <div key={title}
                       className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm
                                  hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} ring-1 ${ring}
                                    flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}>
                      {icon}
                    </div>
                    <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Mobile FAB only */}
          {isAuthenticated && (
            <Link to="/upload-item"
              className="sm:hidden fixed bottom-6 right-6 z-50 inline-flex items-center gap-2
                         px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold
                         rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
              <Plus className="w-5 h-5" />
              Post Item
            </Link>
          )}
        </>
      )}
    </div>
  );
};

export default HomePage;
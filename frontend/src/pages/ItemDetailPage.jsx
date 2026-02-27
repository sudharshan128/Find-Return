/**
 * Item Detail Page
 * View item details and submit claims
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, getImageUrl, supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  MapPin, 
  Calendar, 
  Eye, 
  Star, 
  ChevronLeft, 
  ChevronRight,
  Flag,
  MessageCircle,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import ClaimForm from '../components/claims/ClaimForm';
import { ReportAbuseModal } from '../components/common';

const ItemDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, loading: authLoading } = useAuth();
  
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [userClaimCount, setUserClaimCount] = useState(0);
  const [existingClaim, setExistingClaim] = useState(null);
  const [approvedChatId, setApprovedChatId] = useState(null);

  useEffect(() => {
    // Fetch item (doesn't require auth, but wait for it to be ready)
    if (authLoading) {
      console.log('[ITEM DETAIL] Waiting for auth to initialize...');
      return;
    }

    let isMounted = true;

    const fetchItem = async () => {
      try {
        console.log('[ITEM DETAIL] Fetching item:', id);
        console.log('[ITEM DETAIL] User authenticated:', !!user?.id, 'User ID:', user?.id);
        setLoading(true);
        setError(null);

        const data = await db.items.get(id);
        
        if (!isMounted) return;

        setItem(data);
        console.log('[ITEM DETAIL] Item fetched successfully:', data?.id, data?.title);
        
        // Increment view count (non-critical)
        db.items.incrementView(id).catch(e => console.warn('[ITEM DETAIL] View increment failed:', e));

        // Check user's existing claims if authenticated
        if (user?.id) {
          try {
            const count = await db.claims.getUserClaimCount(id, user.id);
            if (isMounted) setUserClaimCount(count);
            
            // Get all claims for this item
            const claims = await db.claims.getForItem(id);
            
            // Find this user's claim
            const userClaim = claims?.find(c => c.claimant_id === user.id);
            if (isMounted) setExistingClaim(userClaim);

            // For finder: find the approved claim's chat_id for the Go to Chat button
            const approvedClm = claims?.find(c => c.status === 'approved');
            if (approvedClm?.chat_id && isMounted) setApprovedChatId(approvedClm.chat_id);
          } catch (claimError) {
            console.warn('[ITEM DETAIL] Could not fetch claims:', claimError);
          }
        }
      } catch (err) {
        console.error('[ITEM DETAIL] Error fetching item:', err);
        console.error('[ITEM DETAIL] Error details:', {
          message: err.message,
          status: err.status,
          statusText: err.statusText,
          code: err.code,
          hint: err.hint,
          details: err.details
        });
        // Before showing error, check if this user has an approved claim
        // (item becomes 'claimed' after approval → RLS blocks anon view)
        if (user?.id && isMounted) {
          try {
            const { data: approvedClaim } = await supabase
              .from('claims')
              .select('id, status, chat_id')
              .eq('item_id', id)
              .eq('claimant_id', user.id)
              .eq('status', 'approved')
              .maybeSingle();
            if (approvedClaim && isMounted) {
              toast.success('Your claim was approved! Redirecting to chat...');
              navigate(approvedClaim.chat_id ? `/chats/${approvedClaim.chat_id}` : '/chats');
              return;
            }
          } catch { /* ignore, fall through to error */ }
        }
        if (isMounted) {
          setError(err.message || 'Item not found');
          toast.error('Item not found or has been removed.');
          setTimeout(() => navigate('/'), 2000);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchItem();

    return () => {
      isMounted = false;
    };
  }, [id, user?.id, authLoading, navigate]);

  if (loading) {
    return (
      <div className="container-app py-10">
        <div className="max-w-4xl mx-auto animate-pulse space-y-4">
          <div className="aspect-square bg-surface-muted rounded-xl w-full max-w-md" />
          <div className="h-7 bg-surface-muted rounded w-2/3" />
          <div className="h-4 bg-surface-muted rounded w-1/3" />
          <div className="h-4 bg-surface-muted rounded w-1/4" />
        </div>
      </div>
    );
  }

  if (!item) return null;

  const images = item.images || [];
  const isOwner = user?.id === item.finder_id;
  const canClaim = isAuthenticated && !isOwner && (item.status === 'active' || item.status === 'unclaimed') && userClaimCount < 3;

  const statusColors = {
    active: 'badge-info',
    unclaimed: 'badge-info',
    pending: 'badge-warning',
    claimed: 'badge-success',
    returned: 'bg-purple-100 text-purple-800',
    closed: 'badge-secondary',
    archived: 'badge-secondary',
  };

  const claimStatusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <div className="container-app py-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink text-sm font-medium mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to items
        </button>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div>
            <div className="relative aspect-square bg-surface-muted rounded-xl overflow-hidden mb-4 shadow-card">
              {images.length > 0 ? (
                <>
                  <img
                    src={getImageUrl(images[currentImageIndex])}
                    alt={item.title}
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Navigation arrows */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImageIndex((i) => (i - 1 + images.length) % images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow hover:bg-white"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex((i) => (i + 1) % images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow hover:bg-white"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No image available
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, index) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      index === currentImageIndex ? 'border-primary-600 shadow-sm' : 'border-surface-border hover:border-ink-subtle'
                    }`}
                  >
                    <img
                      src={getImageUrl(img)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Item Info */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-2xl font-bold text-ink">{item.title}</h1>
              <span className={`badge ${statusColors[item.status]}`}>
                {(item.status === 'active' || item.status === 'unclaimed') ? 'Available' : item.status}
              </span>
            </div>

            <div className="space-y-3 mb-6">
              {item.category && (
                <div className="flex items-center gap-2 text-ink-muted">
                  <span className="text-xl">{item.category.icon}</span>
                  <span>{item.category.name}</span>
                </div>
              )}
              
              {item.area && (
                <div className="flex items-center gap-2 text-ink-muted">
                  <MapPin className="w-4 h-4" />
                  <span>{item.area.name}</span>
                  {item.location_details && (
                    <span className="text-ink-subtle">• {item.location_details}</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-ink-muted">
                <Calendar className="w-4 h-4" />
                <span>Found {format(new Date(item.found_date || item.created_at), 'MMMM d, yyyy')}</span>
              </div>

              <div className="flex items-center gap-2 text-ink-muted">
                <Eye className="w-4 h-4" />
                <span>{item.view_count || 0} views</span>
              </div>
            </div>

            {/* Description */}
            {item.description && (
              <div className="mb-6">
                <h3 className="card-title mb-2">Description</h3>
                <p className="body-text whitespace-pre-wrap">{item.description}</p>
              </div>
            )}

            {/* Finder Info */}
            {item.finder && (
              <div className="bg-surface-muted rounded-xl p-4 mb-6 border border-surface-border">
                <h3 className="card-title mb-3">Found by</h3>
                <div className="flex items-center gap-3">
                  <img
                    src={item.finder.avatar_url || `https://ui-avatars.com/api/?name=${item.finder.full_name}&background=3b82f6&color=fff`}
                    alt={item.finder.full_name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-ink">{item.finder.full_name}</p>
                    <div className="flex items-center gap-3 text-sm text-ink-muted">
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        Trust: {item.finder.trust_score}/100
                      </span>
                      <span>{item.finder.items_returned} items returned</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Existing Claim Status */}
            {existingClaim && (
              <div className={`rounded-xl p-4 mb-6 ${claimStatusColors[existingClaim.status]}`}>
                <div className="flex items-center gap-2 mb-2">
                  {existingClaim.status === 'pending' && <AlertTriangle className="w-5 h-5" />}
                  {existingClaim.status === 'approved' && <Check className="w-5 h-5" />}
                  {existingClaim.status === 'rejected' && <X className="w-5 h-5" />}
                  <span className="font-semibold capitalize">Your claim is {existingClaim.status}</span>
                </div>
                {existingClaim.status === 'approved' && (
                  <Link
                    to={existingClaim.chat_id ? `/chats/${existingClaim.chat_id}` : '/chats'}
                    className="inline-flex items-center gap-1 text-sm font-semibold underline"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Open your chat with the finder →
                  </Link>
                )}
                {existingClaim.status === 'rejected' && userClaimCount < 3 && (
                  <p className="text-sm">You can submit {3 - userClaimCount} more claim(s).</p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {canClaim && !existingClaim && (
                <button
                  onClick={() => setShowClaimForm(true)}
                  className="btn btn-primary w-full"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Claim This Item
                </button>
              )}

              {isOwner && item.status === 'claimed' && approvedChatId && (
                <Link
                  to={`/chats/${approvedChatId}`}
                  className="btn btn-primary w-full text-center"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Go to Approved Chat
                </Link>
              )}

              {isOwner && (
                <Link
                  to={`/items/${item.id}/claims`}
                  className="btn btn-outline w-full text-center"
                >
                  View Claims ({item.claim_count || 0})
                </Link>
              )}

              {!isAuthenticated && (
                <Link to="/login" className="btn btn-primary w-full text-center">
                  Sign in to Claim
                </Link>
              )}

              {isAuthenticated && !isOwner && (
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="btn btn-ghost w-full text-red-600 hover:bg-red-50"
                >
                  <Flag className="w-5 h-5 mr-2" />
                  Report This Item
                </button>
              )}
            </div>

            {/* Claim limit warning */}
            {isAuthenticated && !isOwner && userClaimCount >= 3 && (
              <p className="mt-4 text-sm text-red-600 text-center font-medium">
                You've reached the maximum of 3 claims for this item.
              </p>
            )}
          </div>
        </div>

        {/* Claim Form Modal */}
        {showClaimForm && (
          <ClaimForm
            item={item}
            onClose={() => setShowClaimForm(false)}
            onSuccess={(claim) => {
              setExistingClaim(claim);
              setUserClaimCount((c) => c + 1);
              setShowClaimForm(false);
              toast.success('Claim submitted! The finder will review your proof.');
            }}
          />
        )}

        {/* Report Abuse Modal */}
        <ReportAbuseModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetType="item"
          targetId={id}
          targetTitle={item?.title}
        />
      </div>
    </div>
  );
};

export default ItemDetailPage;

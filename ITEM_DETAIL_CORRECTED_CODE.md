# ItemDetailPage Fix - Code Blocks

## Corrected Supabase Query

### items.get() - Query to fetch item details for ItemDetailPage

```javascript
items: {
  get: async (itemId) => {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        category:categories(id, name, icon, slug, description),
        area:areas(id, name, zone),
        finder:user_profiles!items_finder_id_fkey(user_id, full_name, avatar_url, trust_score, items_returned_count),
        images:item_images(id, image_url, storage_bucket, storage_path, is_primary)
      `)
      .eq('id', itemId)
      .single();
    if (error) throw error;
    return data;
  },
}
```

**Key Change**: 
- ❌ Before: `finder:user_profiles!finder_id(...)`
- ✅ After: `finder:user_profiles!items_finder_id_fkey(...)`

**Why**: The `items` table has multiple FKs to `user_profiles` (finder_id and flagged_by). Supabase requires the explicit constraint name `items_finder_id_fkey` to disambiguate.

---

## Corrected ItemDetailPage.jsx

### Complete ItemDetailPage.jsx (relevant section)

```jsx
/**
 * Item Detail Page
 * View item details and submit claims
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, getImageUrl } from '../lib/supabase';
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

        // This now uses the corrected query with explicit FK hint
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
            
            // Get user's existing claim if any
            const claims = await db.claims.getForItem(id);
            const userClaim = claims?.find(c => c.claimant_id === user.id);
            if (isMounted) setExistingClaim(userClaim);
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
        if (isMounted) {
          setError(err.message || 'Item not found');
          toast.error(`Item not found: ${err.message || 'Unknown error'}`);
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="aspect-video bg-gray-200 rounded-xl mb-6" />
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
          </div>
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Items
          </button>
          {isOwner && (
            <Link to={`/edit-item/${item.id}`} className="btn btn-secondary">
              Edit Item
            </Link>
          )}
        </div>

        {/* Image carousel */}
        <div className="relative bg-gray-100 rounded-xl overflow-hidden aspect-video mb-6">
          {images.length > 0 ? (
            <>
              <img
                src={getImageUrl(images[currentImageIndex])}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/800x600?text=Image+Not+Found';
                }}
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 btn btn-circle btn-sm bg-black/50 border-0 hover:bg-black/70"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex((i) => (i + 1) % images.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 btn btn-circle btn-sm bg-black/50 border-0 hover:bg-black/70"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                  <div className="absolute bottom-4 right-4 badge badge-neutral">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No images available
            </div>
          )}
        </div>

        {/* Item details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* Title and status */}
            <h1 className="text-4xl font-bold mb-4">{item.title}</h1>
            
            <div className="flex flex-wrap gap-2 mb-6">
              <span className={`badge ${statusColors[item.status] || 'badge-default'}`}>
                {item.status}
              </span>
              {item.category && (
                <span className="badge badge-outline">{item.category.name}</span>
              )}
              {item.area && (
                <span className="badge badge-outline">{item.area.name}</span>
              )}
            </div>

            {/* Description */}
            {item.description && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Description</h2>
                <p className="text-gray-700">{item.description}</p>
              </div>
            )}

            {/* Item details table */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Item Details</h2>
              <div className="space-y-3">
                {item.date_found && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Date Found
                    </span>
                    <span>{format(new Date(item.date_found), 'PPP')}</span>
                  </div>
                )}
                {item.location_details && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Location Details
                    </span>
                    <span>{item.location_details}</span>
                  </div>
                )}
                {item.color && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Color</span>
                    <span>{item.color}</span>
                  </div>
                )}
                {item.brand && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Brand</span>
                    <span>{item.brand}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Views
                  </span>
                  <span>{item.view_count || 0}</span>
                </div>
              </div>
            </div>

            {/* Finder info card */}
            {item.finder && (
              <div className="card bg-base-200 mb-6">
                <div className="card-body">
                  <h2 className="card-title">Item Posted By</h2>
                  <div className="flex items-center gap-4">
                    {item.finder.avatar_url && (
                      <img
                        src={item.finder.avatar_url}
                        alt={item.finder.full_name}
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold">{item.finder.full_name}</h3>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span>{item.finder.trust_score}/100</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {item.finder.items_returned_count} items returned
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            {/* Claim form */}
            {canClaim && !showClaimForm && (
              <div className="card bg-primary text-primary-content shadow mb-4">
                <div className="card-body">
                  <h2 className="card-title">Is this your item?</h2>
                  <p>If you lost this item, you can claim it here.</p>
                  <div className="card-actions">
                    <button
                      onClick={() => setShowClaimForm(true)}
                      className="btn btn-secondary w-full"
                    >
                      Claim This Item
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Existing claim status */}
            {existingClaim && (
              <div className={`card shadow mb-4 ${claimStatusColors[existingClaim.status]}`}>
                <div className="card-body">
                  <h2 className="card-title">Your Claim</h2>
                  <p>Status: <strong>{existingClaim.status}</strong></p>
                  {existingClaim.status === 'rejected' && (
                    <p className="text-sm">{existingClaim.rejection_reason}</p>
                  )}
                </div>
              </div>
            )}

            {/* Report button */}
            <button
              onClick={() => setShowReportModal(true)}
              className="btn btn-ghost btn-block gap-2"
            >
              <Flag className="w-4 h-4" />
              Report Item
            </button>
          </div>
        </div>

        {/* Claim form modal */}
        {showClaimForm && !existingClaim && (
          <ClaimForm
            itemId={item.id}
            onSuccess={() => {
              setShowClaimForm(false);
              toast.success('Claim submitted successfully!');
              // Refresh claims
              fetchItem();
            }}
            onCancel={() => setShowClaimForm(false)}
          />
        )}

        {/* Report modal */}
        {showReportModal && (
          <ReportAbuseModal
            itemId={item.id}
            onClose={() => setShowReportModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ItemDetailPage;
```

## Key Points

### What Changed
Only the Supabase query was updated - **no React component changes needed**.

### The Query Fix
```javascript
// OLD (Ambiguous - causes PGRST201)
finder:user_profiles!finder_id(...)

// NEW (Explicit FK constraint)
finder:user_profiles!items_finder_id_fkey(...)
```

### Why It Works
- The `items` table has 2 FKs to `user_profiles`: `finder_id` and `flagged_by`
- Without the explicit constraint name, Supabase doesn't know which one to use
- By specifying `!items_finder_id_fkey`, we tell Supabase to use the `finder_id` relationship
- This resolves the PGRST201 error

### Component Behavior (Unchanged)
- Still fetches item on mount
- Still handles auth loading state
- Still increments view count
- Still loads user's existing claims if logged in
- Still renders all the same UI

### Files to Update
- ✅ `frontend/src/lib/supabase.js` - Only file that needs code changes (already done)
- ✅ `frontend/src/pages/ItemDetailPage.jsx` - No changes needed, shows for reference

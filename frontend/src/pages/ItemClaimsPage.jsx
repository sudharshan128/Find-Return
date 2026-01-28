/**
 * Item Claims Page
 * View and manage claims for a specific item (finder view)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, storage, getImageUrl } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  ChevronLeft, 
  Check, 
  X, 
  Clock, 
  Star, 
  Eye,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ItemClaimsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [item, setItem] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        console.log('[ITEM CLAIMS] Fetching data for item:', id);
        setError(null);
        
        // Fetch item
        const itemData = await db.items.get(id);
        
        if (!isMounted) return;

        // Verify ownership
        if (itemData.finder_id !== user.id) {
          console.log('[ITEM CLAIMS] Unauthorized - item not owned by user');
          toast.error('You can only view claims for your own items');
          navigate('/my-items');
          return;
        }
        
        console.log('[ITEM CLAIMS] Item verified, fetching claims...');
        setItem(itemData);

        // Fetch claims
        const claimsData = await db.claims.getForItem(id);
        
        if (isMounted) {
          setClaims(claimsData || []);
          console.log('[ITEM CLAIMS] Claims fetched:', (claimsData || []).length);
        }
      } catch (err) {
        console.error('[ITEM CLAIMS] Error fetching data:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load claims');
          toast.error('Failed to load claims');
          setTimeout(() => navigate('/my-items'), 2000);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [id, user.id, navigate]);

  const handleUpdateStatus = async (claimId, status) => {
    setProcessing(true);
    try {
      // Get the claim data first for creating chat
      const claimData = claims.find(c => c.id === claimId);
      
      await db.claims.updateStatus(claimId, status);
      
      // Update local state
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claimId ? { ...c, status, reviewed_at: new Date().toISOString() } : c
        )
      );

      if (status === 'approved') {
        // Create a chat between finder and claimant
        try {
          await db.chats.getOrCreate(
            id, // item_id
            claimId, // claim_id
            user.id, // finder_id
            claimData?.claimant?.user_id || claimData?.claimant_id // claimant_id
          );
        } catch (chatError) {
          console.error('Failed to create chat:', chatError);
          // Continue even if chat creation fails
        }
        
        toast.success('Claim approved! A chat has been created with the claimant.');
        
        // Update item status
        await db.items.update(id, { status: 'claimed' });
        setItem((prev) => ({ ...prev, status: 'claimed' }));
      } else {
        toast.success('Claim rejected');
      }
      
      setSelectedClaim(null);
    } catch (error) {
      console.error('Error updating claim:', error);
      toast.error('Failed to update claim');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-6" />
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="card p-6">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate('/my-items')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to my items
        </button>

        {/* Item Info */}
        {item && (
          <div className="card mb-6">
            <div className="flex gap-4">
              {item.images?.[0] && (
                <img
                  src={getImageUrl(item.images[0])}
                  alt={item.title}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">{item.title}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {claims.length} claim(s) • {item.view_count || 0} views
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Claims List */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Claims</h2>

        {claims.length === 0 ? (
          <div className="card text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No claims yet</h3>
            <p className="text-gray-500">When someone claims this item, it will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <div key={claim.id} className="card">
                {/* Claim Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={claim.claimant?.avatar_url || `https://ui-avatars.com/api/?name=${claim.claimant?.full_name}&background=3b82f6&color=fff`}
                      alt={claim.claimant?.full_name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{claim.claimant?.full_name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span>Trust: {claim.claimant?.trust_score || 50}/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {claim.status === 'pending' && (
                      <span className="badge badge-warning">Pending</span>
                    )}
                    {claim.status === 'approved' && (
                      <span className="badge badge-success">Approved</span>
                    )}
                    {claim.status === 'rejected' && (
                      <span className="badge badge-danger">Rejected</span>
                    )}
                  </div>
                </div>

                {/* Claim Answers */}
                {claim.answers && (
                  <div className="space-y-4 mb-4">
                    {claim.answers.unique_marks && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Unique Identifying Marks
                        </p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                          {claim.answers.unique_marks}
                        </p>
                      </div>
                    )}

                    {claim.answers.contents_description && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Contents Description
                        </p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                          {claim.answers.contents_description}
                        </p>
                      </div>
                    )}

                    {claim.answers.loss_circumstances && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Loss Circumstances
                        </p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                          {claim.answers.loss_circumstances}
                        </p>
                      </div>
                    )}

                    {claim.answers.additional_info && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Additional Information
                        </p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                          {claim.answers.additional_info}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Proof Description */}
                {claim.proof_description && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      How They Lost It
                    </p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {claim.proof_description}
                    </p>
                  </div>
                )}

                {/* Description (Unique Marks) */}
                {claim.description && !claim.answers?.unique_marks && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Unique Identifying Marks
                    </p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {claim.description}
                    </p>
                  </div>
                )}

                {/* Proof Images */}
                {claim.proof_images && claim.proof_images.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      Proof Images ({claim.proof_images.length})
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {claim.proof_images.map((imageUrl, index) => (
                        <a 
                          key={index} 
                          href={imageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={imageUrl}
                            alt={`Proof ${index + 1}`}
                            className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-500 transition-colors cursor-pointer"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 mb-4">
                  Submitted {formatDistanceToNow(new Date(claim.created_at), { addSuffix: true })}
                </p>

                {/* Actions */}
                {claim.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => handleUpdateStatus(claim.id, 'approved')}
                      disabled={processing}
                      className="btn btn-success flex-1"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(claim.id, 'rejected')}
                      disabled={processing}
                      className="btn btn-danger flex-1"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Warning */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Verification Tips</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Look for specific details only the true owner would know</li>
              <li>Be cautious of vague or generic descriptions</li>
              <li>Ask follow-up questions in chat if needed after approving</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemClaimsPage;

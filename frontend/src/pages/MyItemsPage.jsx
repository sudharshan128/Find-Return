/**
 * My Items Page
 * View and manage user's found items
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, storage, getImageUrl, supabase } from '../lib/supabase';
import { 
  Plus, 
  Eye, 
  MessageCircle, 
  Archive, 
  MoreVertical,
  Edit,
  X,
  Trash2,
  XCircle,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// Dropdown Menu Component
const ItemDropdownMenu = ({ item, onEdit, onClose, onDelete, isOpen, setIsOpen }) => {
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      
      // Calculate position when menu opens
      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setIsOpen]);

  const isItemClosed = item.status === 'closed' || item.status === 'returned';
  const hasPendingClaims = item.claim_count > 0;

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
        aria-label="Item actions"
      >
        <MoreVertical className="w-5 h-5 text-ink-subtle" />
      </button>

      {isOpen && (
        <div 
          className="fixed w-48 bg-white rounded-lg shadow-dropdown border border-surface-border py-1"
          style={{
            zIndex: 9999,
            top: `${menuPosition.top}px`,
            right: `${menuPosition.right}px`,
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isItemClosed) {
                onEdit();
                setIsOpen(false);
              }
            }}
            disabled={isItemClosed}
            className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm ${
              isItemClosed 
                ? 'text-ink-subtle cursor-not-allowed' 
                : 'text-ink hover:bg-surface-muted/50'
            }`}
            title={isItemClosed ? 'Cannot edit closed items' : 'Edit item details'}
          >
            <Edit className="w-4 h-4" />
            Edit Item
          </button>

          {item.status !== 'returned' && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-ink hover:bg-surface-muted/50"
            >
              {item.status === 'closed' ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Reopen Item
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-orange-600" />
                  Close Item
                </>
              )}
            </button>
          )}

          <div className="border-t border-surface-border my-1" />

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Item
            {hasPendingClaims && (
              <span className="text-xs text-gray-400 ml-auto">(soft)</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

// Confirmation Modal
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, danger }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-full ${danger ? 'bg-red-100' : 'bg-orange-100'}`}>
            <AlertTriangle className={`w-6 h-6 ${danger ? 'text-red-600' : 'text-orange-600'}`} />
          </div>
          <div>
            <h3 className="card-title">{title}</h3>
            <p className="body-text mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Edit Modal
const EditModal = ({ isOpen, item, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location_details: '',
    color: '',
    brand: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title || '',
        description: item.description || '',
        location_details: item.location_details || '',
        color: item.color || '',
        brand: item.brand || '',
      });
    }
  }, [item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-surface-border px-6 py-4 flex items-center justify-between">
          <h2 className="card-title">Edit Item</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-muted rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input"
              placeholder="Item title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input min-h-[100px]"
              placeholder="Describe the item..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location Details</label>
            <input
              type="text"
              value={formData.location_details}
              onChange={(e) => setFormData({ ...formData, location_details: e.target.value })}
              className="input"
              placeholder="Specific location where found"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="input"
                placeholder="Item color"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="input"
                placeholder="Brand name"
              />
            </div>
          </div>

          <div className="bg-surface-muted rounded-lg p-4 text-sm">
            <p className="label mb-2">Cannot be changed:</p>
            <ul className="space-y-1 text-ink-muted">
              <li>• Category: {item.category?.name || 'N/A'}</li>
              <li>• Area: {item.area?.name || 'N/A'}</li>
              <li>• Date Found: {item.date_found || 'N/A'}</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MyItemsPage = () => {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [error, setError] = useState(null);
  
  // Modal states
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null });
  const [closeModal, setCloseModal] = useState({ isOpen: false, item: null });
  const [editModal, setEditModal] = useState({ isOpen: false, item: null });

  useEffect(() => {
    // Wait for auth to initialize
    if (initializing) {
      console.log('[MY ITEMS] Waiting for auth to initialize...');
      return;
    }
    
    // Guard: no user
    if (!user?.id) {
      console.log('[MY ITEMS] No user, setting loading to false');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchItems = async () => {
      try {
        console.log('[MY ITEMS] Fetching items for user:', user.id);
        setLoading(true);
        setError(null);
        
        const data = await db.items.getByUser(user.id);
        
        if (!isMounted) return;
        
        console.log('[MY ITEMS] Items fetched:', (data || []).length);
        // Sort: pending claims first, then active, then closed
        const sorted = (data || []).sort((a, b) => {
          if ((a.claim_count || 0) > 0 && (b.claim_count || 0) === 0) return -1;
          if ((a.claim_count || 0) === 0 && (b.claim_count || 0) > 0) return 1;
          
          const statusOrder = { active: 0, unclaimed: 0, pending: 1, claimed: 2, closed: 3, returned: 4 };
          const aOrder = statusOrder[a.status] ?? 5;
          const bOrder = statusOrder[b.status] ?? 5;
          if (aOrder !== bOrder) return aOrder - bOrder;
          
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setItems(sorted);
      } catch (error) {
        console.error('[MY ITEMS] Error fetching items:', error);
        if (isMounted) {
          setError(error.message || 'Failed to load items');
          toast.error('Failed to load items');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchItems();

    return () => {
      isMounted = false;
    };
  }, [user?.id, initializing]);

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'active') return item.status === 'active' || item.status === 'unclaimed';
    return item.status === filter;
  });

  // Handle Delete
  const handleDelete = async () => {
    const item = deleteModal.item;
    console.log('handleDelete called', item);
    if (!item) {
      console.log('No item to delete');
      return;
    }

    try {
      const hasClaims = (item.claim_count || 0) > 0;
      console.log('Has claims:', hasClaims);
      
      if (hasClaims) {
        console.log('Soft deleting (setting status to removed)');
        await db.items.update(item.id, { status: 'removed' });
        toast.success('Item has been removed');
      } else {
        console.log('Hard deleting item');
        if (item.images && item.images.length > 0) {
          console.log('Deleting images:', item.images);
          for (const img of item.images) {
            try {
              if (img.storage_path) {
                console.log('Deleting image:', img.storage_path);
                await storage.deleteImage('item-images', img.storage_path);
              }
            } catch (imgError) {
              console.error('Failed to delete image:', imgError);
            }
          }
        }
        
        console.log('Deleting item from database:', item.id);
        const { error } = await supabase.from('items').delete().eq('id', item.id);
        if (error) {
          console.error('Delete error from Supabase:', error);
          throw error;
        }
        toast.success('Item deleted permanently');
      }

      setItems(prev => prev.filter(i => i.id !== item.id));
      console.log('Delete successful');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete item: ' + (error.message || 'Unknown error'));
    } finally {
      setDeleteModal({ isOpen: false, item: null });
    }
  };

  // Handle Close/Reopen
  const handleCloseItem = async () => {
    const item = closeModal.item;
    if (!item) return;

    try {
      const newStatus = item.status === 'closed' ? 'active' : 'closed';
      await db.items.update(item.id, { status: newStatus });
      
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: newStatus } : i
      ));
      
      toast.success(newStatus === 'closed' ? 'Item closed - no new claims allowed' : 'Item reopened');
    } catch (error) {
      console.error('Close error:', error);
      toast.error('Failed to update item');
    } finally {
      setCloseModal({ isOpen: false, item: null });
    }
  };

  // Handle Edit
  const handleEdit = async (formData) => {
    const item = editModal.item;
    if (!item) return;

    try {
      await db.items.update(item.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        location_details: formData.location_details.trim() || null,
        color: formData.color.trim() || null,
        brand: formData.brand.trim() || null,
      });
      
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, ...formData } : i
      ));
      
      toast.success('Item updated successfully');
    } catch (error) {
      console.error('Edit error:', error);
      toast.error('Failed to update item');
      throw error;
    }
  };

  const statusColors = {
    active: 'badge-info',
    unclaimed: 'badge-info',
    pending: 'badge-warning',
    claimed: 'badge-success',
    closed: 'badge-secondary',
    returned: 'bg-purple-100 text-purple-800',
    archived: 'badge-secondary',
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: 'Available',
      unclaimed: 'Available',
      pending: 'Pending',
      claimed: 'Claimed',
      closed: 'Closed',
      returned: 'Returned',
      archived: 'Archived',
    };
    return labels[status] || status;
  };

  if (loading || initializing) {
    return (
      <div className="container-app py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-6">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-surface-muted rounded-lg" />
                  <div className="flex-1">
                    <div className="h-6 bg-surface-muted rounded w-1/2 mb-3" />
                    <div className="h-4 bg-surface-muted rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-app py-8">
        <div className="max-w-4xl mx-auto">
          <div className="card text-center py-12">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="card-title mb-2">Failed to load items</h2>
            <p className="body-text mb-4">{error}</p>
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
    <div className="container-app py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title mb-1">My Found Items</h1>
            <p className="body-text">Items you've reported finding ({items.length} total)</p>
          </div>
          <Link to="/report" className="btn btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Report Item
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All Items' },
            { key: 'active', label: 'Active' },
            { key: 'closed', label: 'Closed' },
            { key: 'claimed', label: 'Claimed' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-muted text-ink hover:bg-surface-border'
              }`}
            >
              {label}
              {key !== 'all' && (
                <span className="ml-2">
                  ({items.filter((i) => {
                    if (key === 'active') return i.status === 'active' || i.status === 'unclaimed';
                    return i.status === key;
                  }).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div className="card text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-muted rounded-full mb-4">
              <Archive className="w-8 h-8 text-ink-subtle" />
            </div>
            <h3 className="card-title mb-1">
              {filter === 'all' ? "You haven't reported any items yet" : `No ${filter} items`}
            </h3>
            <p className="body-text mb-4">
              {filter === 'all'
                ? 'When you find something, report it here to help reunite it with its owner'
                : 'Try selecting a different filter'}
            </p>
            <Link to="/report" className="btn btn-primary">
              <Plus className="w-5 h-5 mr-2" />
              Report Found Item
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const primaryImage = item.images?.find((i) => i.is_primary) || item.images?.[0];
              const hasClaims = (item.claim_count || 0) > 0;

              return (
                <div 
                  key={item.id} 
                  className={`card hover:shadow-card-hover transition-shadow ${
                    hasClaims ? 'ring-2 ring-primary-200' : ''
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Item Image */}
                    <Link to={`/items/${item.id}`} className="flex-shrink-0">
                      {primaryImage ? (
                        <img
                          src={getImageUrl(primaryImage)}
                          alt={item.title}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-surface-muted rounded-lg flex items-center justify-center">
                          <Archive className="w-8 h-8 text-ink-subtle" />
                        </div>
                      )}
                    </Link>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link
                          to={`/items/${item.id}`}
                          className="font-semibold text-ink hover:text-primary-600 truncate"
                        >
                          {item.title}
                        </Link>
                        <span className={`flex-shrink-0 badge ${statusColors[item.status] || 'badge-secondary'}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 caption mb-3">
                        {item.category && (
                          <span>{item.category.icon} {item.category.name}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {item.view_count || 0} views
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <Link
                          to={`/items/${item.id}/claims`}
                          className={`inline-flex items-center gap-1 text-sm font-medium ${
                            hasClaims 
                              ? 'text-primary-600 hover:text-primary-700' 
                              : 'text-gray-500'
                          }`}
                        >
                          <MessageCircle className="w-4 h-4" />
                          {item.claim_count || 0} claims
                          {hasClaims && (
                            <span className="ml-1 w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                          )}
                        </Link>

                        <span className="text-sm text-gray-500">
                          Posted {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex-shrink-0">
                      <ItemDropdownMenu
                        item={item}
                        isOpen={openMenuId === item.id}
                        setIsOpen={(open) => setOpenMenuId(open ? item.id : null)}
                        onEdit={() => setEditModal({ isOpen: true, item })}
                        onClose={() => setCloseModal({ isOpen: true, item })}
                        onDelete={() => setDeleteModal({ isOpen: true, item })}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, item: null })}
        onConfirm={handleDelete}
        title="Delete Item"
        message={
          deleteModal.item?.claim_count > 0
            ? "This item has claims. It will be marked as removed but claim history will be preserved."
            : "Are you sure you want to delete this item? This action cannot be undone."
        }
        confirmText="Delete Item"
        danger={true}
      />

      {/* Close Confirmation Modal */}
      <ConfirmModal
        isOpen={closeModal.isOpen}
        onClose={() => setCloseModal({ isOpen: false, item: null })}
        onConfirm={handleCloseItem}
        title={closeModal.item?.status === 'closed' ? 'Reopen Item' : 'Close Item'}
        message={
          closeModal.item?.status === 'closed'
            ? "Reopening will allow users to submit new claims for this item."
            : "Closing this item will prevent new claims. You can reopen it later."
        }
        confirmText={closeModal.item?.status === 'closed' ? 'Reopen' : 'Close Item'}
        danger={false}
      />

      {/* Edit Modal */}
      <EditModal
        isOpen={editModal.isOpen}
        item={editModal.item}
        onClose={() => setEditModal({ isOpen: false, item: null })}
        onSave={handleEdit}
      />
    </div>
  );
};

export default MyItemsPage;

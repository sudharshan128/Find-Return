/**
 * Item Card Component
 * Displays a single item in the grid
 */

import { Link } from 'react-router-dom';
import { MapPin, Calendar, Eye, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getPrimaryImageUrl } from '../../lib/supabase';

const ItemCard = ({ item }) => {
  // Generate image URL from storage_bucket + storage_path
  const imageUrl = getPrimaryImageUrl(item.images) || 'https://placehold.co/400x300/e2e8f0/64748b?text=No+Image';

  const statusColors = {
    unclaimed: 'badge-info',
    pending: 'badge-warning',
    claimed: 'badge-success',
    archived: 'badge-secondary',
    active: 'badge-info',
  };

  return (
    <Link
      to={`/items/${item.id}`}
      className="card group hover:shadow-card-hover transition-all duration-300 overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={imageUrl}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <span className={`badge ${statusColors[item.status] || 'badge-secondary'}`}>
            {(item.status === 'unclaimed' || item.status === 'active') ? 'Available' : item.status}
          </span>
        </div>

        {/* Views */}
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/50 rounded-full text-white text-xs">
          <Eye className="w-3 h-3" />
          {item.view_count || 0}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1 group-hover:text-primary-600 transition-colors">
          {item.title}
        </h3>

        {item.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="space-y-2">
          {/* Category */}
          {item.category && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Tag className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.category.name}</span>
            </div>
          )}

          {/* Location */}
          {item.area && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.area.name}</span>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>
              Found {formatDistanceToNow(new Date(item.found_date || item.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ItemCard;

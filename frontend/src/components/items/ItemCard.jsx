/**
 * ItemCard â€” Professional item listing card
 * Classic clean design with subtle hover lift
 */

import { Link } from 'react-router-dom';
import { MapPin, Clock, Eye, Tag, ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getPrimaryImageUrl } from '../../lib/supabase';

const STATUS_CONFIG = {
  active:    { label: 'Available',     cls: 'badge-info' },
  unclaimed: { label: 'Available',     cls: 'badge-info' },
  claimed:   { label: 'Claimed',       cls: 'badge-warning' },
  pending:   { label: 'Pending',       cls: 'badge-warning' },
  returned:  { label: 'Returned',      cls: 'badge-success' },
  archived:  { label: 'Archived',      cls: 'badge-secondary' },
  removed:   { label: 'Removed',       cls: 'badge-secondary' },
};

const ItemCard = ({ item }) => {
  const imageUrl =
    getPrimaryImageUrl(item.images) ||
    'https://placehold.co/600x400/f1f5f9/94a3b8?text=No+Image';

  const status = STATUS_CONFIG[item.status] ?? { label: item.status, cls: 'badge-secondary' };
  const timeAgo = formatDistanceToNow(
    new Date(item.found_date || item.created_at),
    { addSuffix: true }
  );

  return (
    <Link
      to={`/items/${item.id}`}
      className="group flex flex-col bg-white rounded-xl border border-surface-border shadow-card
                 hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200 overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-surface-muted overflow-hidden">
        <img
          src={imageUrl}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />

        {/* Status badge â€” top left */}
        <span className={`absolute top-3 left-3 ${status.cls} shadow-sm`}>
          {status.label}
        </span>

        {/* View count â€” top right */}
        <span className="absolute top-3 right-3 flex items-center gap-1
                         bg-black/40 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
          <Eye className="w-3 h-3" />
          {item.view_count || 0}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Category tag */}
        {item.category && (
          <span className="inline-flex items-center gap-1 text-2xs font-medium text-ink-muted">
            <Tag className="w-3 h-3" />
            {item.category.name}
          </span>
        )}

        {/* Title */}
        <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-2
                        group-hover:text-primary-700 transition-colors duration-150">
          {item.title}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-xs text-ink-subtle line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Meta row */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-border">
          <div className="flex flex-col gap-0.5">
            {item.area && (
              <span className="flex items-center gap-1 text-xs text-ink-subtle">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">{item.area.name}</span>
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-ink-subtle">
              <Clock className="w-3 h-3 shrink-0" />
              {timeAgo}
            </span>
          </div>

          <span className="flex items-center gap-0.5 text-xs font-medium text-primary-600
                           opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            View
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ItemCard;

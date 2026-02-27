/**
 * Empty State Component
 * Consistent empty state UI for lists and pages
 */

import { Link } from 'react-router-dom';
import { Package, Search, MessageCircle, FileText, Users, ShieldAlert } from 'lucide-react';

const iconMap = {
  items: Package,
  search: Search,
  claims: FileText,
  chats: MessageCircle,
  users: Users,
  reports: ShieldAlert,
  default: Package,
};

const EmptyState = ({
  icon = 'default',
  title = 'Nothing here yet',
  description = '',
  actionLabel = null,
  actionHref = null,
  onAction = null,
  size = 'default', // compact, default, large
}) => {
  const Icon = typeof icon === 'string' ? (iconMap[icon] || iconMap.default) : icon;

  const sizeStyles = {
    compact: {
      container: 'py-8',
      icon: 'w-10 h-10',
      iconWrapper: 'w-16 h-16',
      title: 'text-base',
      description: 'text-sm',
    },
    default: {
      container: 'py-12',
      icon: 'w-8 h-8',
      iconWrapper: 'w-16 h-16',
      title: 'text-lg',
      description: 'text-sm',
    },
    large: {
      container: 'py-16',
      icon: 'w-12 h-12',
      iconWrapper: 'w-24 h-24',
      title: 'text-xl',
      description: 'text-base',
    },
  };

  const styles = sizeStyles[size] || sizeStyles.default;

  return (
    <div className={`text-center ${styles.container}`}>
      <div className={`inline-flex items-center justify-center ${styles.iconWrapper} bg-gray-100 rounded-full mb-4`}>
        <Icon className={`${styles.icon} text-gray-400`} />
      </div>
      
      <h3 className={`font-medium text-gray-900 mb-1 ${styles.title}`}>
        {title}
      </h3>
      
      {description && (
        <p className={`text-gray-500 mb-4 max-w-sm mx-auto ${styles.description}`}>
          {description}
        </p>
      )}
      
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link to={actionHref} className="btn btn-primary">
            {actionLabel}
          </Link>
        ) : (
          <button onClick={onAction} className="btn btn-primary">
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
};

// Pre-configured empty states for common scenarios
export const EmptyItems = () => (
  <EmptyState
    icon="items"
    title="No items found"
    description="When you report a found item, it will appear here"
    actionLabel="Report Found Item"
    actionHref="/upload-item"
  />
);

export const EmptyClaims = () => (
  <EmptyState
    icon="claims"
    title="No claims yet"
    description="When you claim an item, it will appear here"
    actionLabel="Browse Items"
    actionHref="/"
  />
);

export const EmptyChats = () => (
  <EmptyState
    icon="chats"
    title="No conversations"
    description="Chats are created when a claim is approved"
  />
);

export const EmptySearch = ({ onReset }) => (
  <EmptyState
    icon="search"
    title="No matching items"
    description="Try adjusting your filters or search terms"
    actionLabel="Clear Filters"
    onAction={onReset}
  />
);

export const EmptyPendingClaims = () => (
  <EmptyState
    icon="claims"
    title="No pending claims"
    description="When someone claims this item, it will appear here"
    size="compact"
  />
);

export default EmptyState;

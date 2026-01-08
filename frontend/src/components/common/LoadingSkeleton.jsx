/**
 * Loading Skeleton Components
 * Reusable skeleton loaders for consistent loading states
 */

// Base skeleton pulse animation
const Skeleton = ({ className = '', ...props }) => (
  <div
    className={`animate-pulse bg-gray-200 rounded ${className}`}
    {...props}
  />
);

// Item Card Skeleton
export const ItemCardSkeleton = () => (
  <div className="card overflow-hidden">
    <Skeleton className="aspect-[4/3] rounded-none" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  </div>
);

// Item Grid Skeleton
export const ItemGridSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(count)].map((_, i) => (
      <ItemCardSkeleton key={i} />
    ))}
  </div>
);

// Item List Row Skeleton
export const ItemListSkeleton = () => (
  <div className="card p-4">
    <div className="flex gap-4">
      <Skeleton className="w-24 h-24 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
    </div>
  </div>
);

// Item Detail Skeleton
export const ItemDetailSkeleton = () => (
  <div className="max-w-4xl mx-auto">
    <Skeleton className="h-8 w-32 mb-6" />
    <div className="grid lg:grid-cols-2 gap-8">
      <Skeleton className="aspect-square rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <div className="pt-4 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-12 w-full mt-6" />
      </div>
    </div>
  </div>
);

// Claim Card Skeleton
export const ClaimCardSkeleton = () => (
  <div className="card p-6">
    <div className="flex items-start gap-4 mb-4">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
    <div className="flex gap-3 mt-4">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 flex-1" />
    </div>
  </div>
);

// Chat List Skeleton
export const ChatListSkeleton = ({ count = 5 }) => (
  <div className="space-y-2">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="flex gap-3 p-4 rounded-lg bg-gray-50">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

// Chat Messages Skeleton
export const ChatMessagesSkeleton = () => (
  <div className="space-y-4">
    {[0, 1, 0, 1, 0].map((align, i) => (
      <div key={i} className={`flex ${align ? 'justify-end' : ''}`}>
        <Skeleton className={`h-16 w-2/3 rounded-2xl`} />
      </div>
    ))}
  </div>
);

// Profile Skeleton
export const ProfileSkeleton = () => (
  <div className="max-w-2xl mx-auto">
    <div className="card p-6 mb-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="text-center p-4 bg-gray-50 rounded-lg">
            <Skeleton className="h-8 w-12 mx-auto mb-2" />
            <Skeleton className="h-4 w-20 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Admin Stats Skeleton
export const AdminStatsSkeleton = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="card p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-14 h-14 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Table Row Skeleton
export const TableRowSkeleton = ({ columns = 5 }) => (
  <tr>
    {[...Array(columns)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

export default Skeleton;

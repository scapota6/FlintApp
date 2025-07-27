export default function SkeletonCard() {
  return (
    <div className="account-card skeleton-card animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-lg skeleton-shimmer"></div>
          <div>
            <div className="h-5 w-32 bg-gray-700/50 rounded skeleton-shimmer mb-2"></div>
            <div className="h-4 w-24 bg-gray-700/50 rounded skeleton-shimmer"></div>
          </div>
        </div>
        <div className="text-right">
          <div className="h-6 w-24 bg-gray-700/50 rounded skeleton-shimmer mb-2"></div>
          <div className="h-4 w-16 bg-gray-700/50 rounded skeleton-shimmer"></div>
        </div>
      </div>
    </div>
  );
}
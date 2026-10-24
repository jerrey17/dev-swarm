// ── LoadingSkeleton ── 加载骨架屏（迁移自 claude-board）

interface LoadingSkeletonProps {
  readonly count?: number;
}

export function LoadingSkeleton({ count = 3 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-gray-200 dark:border-gray-800 p-4"
        >
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

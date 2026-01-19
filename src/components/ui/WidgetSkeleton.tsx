"use client";

interface WidgetSkeletonProps {
  className?: string;
  rows?: number;
  showHeader?: boolean;
}

/**
 * Skeleton loader for widget components
 * Used as a fallback during dynamic imports
 */
export function WidgetSkeleton({
  className = "",
  rows = 5,
  showHeader = true
}: WidgetSkeletonProps) {
  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden animate-pulse ${className}`}>
      {showHeader && (
        <div className="px-4 sm:px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#2a2a2a]" />
            <div className="space-y-2">
              <div className="h-5 w-32 bg-[#2a2a2a] rounded" />
              <div className="h-4 w-48 bg-[#2a2a2a] rounded" />
            </div>
          </div>
        </div>
      )}
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-[#2a2a2a] flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[#2a2a2a] rounded w-3/4" />
              <div className="h-3 bg-[#2a2a2a] rounded w-1/2" />
            </div>
            <div className="w-12 h-8 rounded bg-[#2a2a2a] flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

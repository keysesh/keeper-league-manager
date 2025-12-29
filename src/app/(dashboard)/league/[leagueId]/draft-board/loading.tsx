export default function DraftBoardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-gray-700 rounded mb-2" />
          <div className="h-4 w-64 bg-gray-700 rounded" />
        </div>
        <div className="h-10 w-32 bg-gray-700 rounded" />
      </div>

      {/* Legend skeleton */}
      <div className="flex gap-4 flex-wrap">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-700 rounded" />
            <div className="h-4 w-20 bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Draft board skeleton */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Column headers */}
          <div className="grid grid-cols-13 gap-1 mb-2">
            <div className="h-8 bg-gray-700 rounded" />
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-700 rounded" />
            ))}
          </div>

          {/* Rows */}
          {[...Array(16)].map((_, row) => (
            <div key={row} className="grid grid-cols-13 gap-1 mb-1">
              <div className="h-12 bg-gray-700 rounded" />
              {[...Array(12)].map((_, col) => (
                <div key={col} className="h-12 bg-gray-800 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

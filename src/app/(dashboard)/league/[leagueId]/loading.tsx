export default function LeagueLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-64 bg-gray-700 rounded mb-2" />
          <div className="h-4 w-32 bg-gray-700 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-gray-700 rounded" />
          <div className="h-10 w-32 bg-gray-700 rounded" />
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4">
            <div className="h-4 w-20 bg-gray-700 rounded mb-2" />
            <div className="h-8 w-12 bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Rosters grid skeleton */}
      <div>
        <div className="h-6 w-32 bg-gray-700 rounded mb-4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-700 rounded-full" />
                <div>
                  <div className="h-5 w-32 bg-gray-700 rounded mb-1" />
                  <div className="h-3 w-20 bg-gray-700 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-4 bg-gray-700 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

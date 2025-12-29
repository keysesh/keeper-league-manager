export default function DashboardLoading() {
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

      {/* Season selector */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 w-20 bg-gray-700 rounded" />
        ))}
      </div>

      {/* Leagues grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gray-700 rounded-full" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-gray-700 rounded mb-2" />
                <div className="h-4 w-24 bg-gray-700 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-700 rounded" />
              <div className="h-4 w-3/4 bg-gray-700 rounded" />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="h-8 w-full bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

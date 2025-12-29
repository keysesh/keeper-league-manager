export default function TeamLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-700 rounded-full" />
          <div>
            <div className="h-8 w-48 bg-gray-700 rounded mb-2" />
            <div className="h-4 w-32 bg-gray-700 rounded" />
          </div>
        </div>
        <div className="h-10 w-36 bg-gray-700 rounded" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4">
            <div className="h-4 w-16 bg-gray-700 rounded mb-2" />
            <div className="h-8 w-20 bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Keeper selections */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="h-6 w-40 bg-gray-700 rounded mb-4" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-700 rounded" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-gray-700 rounded mb-2" />
                <div className="h-4 w-24 bg-gray-700 rounded" />
              </div>
              <div className="h-8 w-20 bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Roster */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="h-6 w-32 bg-gray-700 rounded mb-4" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-900 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

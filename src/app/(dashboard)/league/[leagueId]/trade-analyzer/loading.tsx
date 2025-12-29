export default function TradeAnalyzerLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-8 w-48 bg-gray-700 rounded mb-2" />
        <div className="h-4 w-80 bg-gray-700 rounded" />
      </div>

      {/* Trade builder */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Team 1 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="h-6 w-32 bg-gray-700 rounded mb-4" />
          <div className="h-10 w-full bg-gray-700 rounded mb-4" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-900 rounded" />
            ))}
          </div>
        </div>

        {/* Team 2 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="h-6 w-32 bg-gray-700 rounded mb-4" />
          <div className="h-10 w-full bg-gray-700 rounded mb-4" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-900 rounded" />
            ))}
          </div>
        </div>
      </div>

      {/* Analysis button */}
      <div className="flex justify-center">
        <div className="h-12 w-48 bg-gray-700 rounded" />
      </div>

      {/* Analysis results placeholder */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="h-6 w-40 bg-gray-700 rounded mb-4" />
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg p-4">
              <div className="h-4 w-24 bg-gray-700 rounded mb-2" />
              <div className="h-8 w-16 bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

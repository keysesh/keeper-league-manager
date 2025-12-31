import { Skeleton } from "@/components/ui/Skeleton";

export default function SimulationLoading() {
  return (
    <div className="min-h-screen bg-[#09090b] p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Controls skeleton */}
      <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] mb-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Two column layout skeleton */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Team roster */}
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Simulation results */}
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

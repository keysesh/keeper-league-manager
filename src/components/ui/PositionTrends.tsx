"use client";

import useSWR from "swr";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { BarChart3 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

interface KeeperHistory {
  id: string;
  season: number;
  player: {
    position: string | null;
  };
}

interface HistoryResponse {
  keepers: KeeperHistory[];
}

interface PositionTrendsProps {
  leagueId: string;
}

export function PositionTrends({ leagueId }: PositionTrendsProps) {
  const { data, error, isLoading } = useSWR<HistoryResponse>(
    `/api/leagues/${leagueId}/history`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-8 h-8 rounded-lg bg-white/[0.05]" />
          <Skeleton className="h-5 w-32 bg-white/[0.05]" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !data.keepers || data.keepers.length === 0) {
    return null; // Don't show if no data
  }

  const keepers = data.keepers;
  const totalKeepers = keepers.length;

  const positionData = ["QB", "RB", "WR", "TE"].map((position) => {
    const count = keepers.filter((k) => k.player.position === position).length;
    const percentage = totalKeepers > 0 ? Math.round((count / totalKeepers) * 100) : 0;
    return { position, count, percentage };
  });

  const positionColors: Record<string, string> = {
    QB: "bg-red-500",
    RB: "bg-emerald-500",
    WR: "bg-blue-500",
    TE: "bg-orange-500",
  };

  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/25 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm">Position Trends</h3>
          <p className="text-xs text-slate-500">League-wide keeper distribution</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {positionData.map(({ position, count, percentage }) => (
          <div
            key={position}
            className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
          >
            <PositionBadge position={position} size="sm" />
            <p className="text-lg font-bold text-white mt-2">{count}</p>
            <p className="text-[10px] text-slate-500">{percentage}%</p>
            <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${positionColors[position]}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

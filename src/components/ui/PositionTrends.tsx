"use client";

import { useState } from "react";
import useSWR from "swr";
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

interface PositionConfig {
  position: string;
  color: string;
  bgColor: string;
  hoverBg: string;
  borderColor: string;
  textColor: string;
}

const POSITION_CONFIGS: PositionConfig[] = [
  {
    position: "QB",
    color: "bg-red-500",
    bgColor: "bg-red-500/15",
    hoverBg: "hover:bg-red-500/25",
    borderColor: "border-red-500/30",
    textColor: "text-red-400"
  },
  {
    position: "RB",
    color: "bg-emerald-500",
    bgColor: "bg-emerald-500/15",
    hoverBg: "hover:bg-emerald-500/25",
    borderColor: "border-emerald-500/30",
    textColor: "text-emerald-400"
  },
  {
    position: "WR",
    color: "bg-blue-500",
    bgColor: "bg-blue-500/15",
    hoverBg: "hover:bg-blue-500/25",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-400"
  },
  {
    position: "TE",
    color: "bg-amber-500",
    bgColor: "bg-amber-500/15",
    hoverBg: "hover:bg-amber-500/25",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-400"
  },
];

export function PositionTrends({ leagueId }: PositionTrendsProps) {
  const [hoveredPosition, setHoveredPosition] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR<HistoryResponse>(
    `/api/leagues/${leagueId}/history`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  if (isLoading) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-8 h-8 rounded-lg bg-white/[0.05]" />
          <Skeleton className="h-5 w-32 bg-white/[0.05]" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg bg-white/[0.03] mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !data.keepers || data.keepers.length === 0) {
    return null;
  }

  const keepers = data.keepers;
  const totalKeepers = keepers.length;

  const positionData = POSITION_CONFIGS.map((config) => {
    const count = keepers.filter((k) => k.player.position === config.position).length;
    const percentage = totalKeepers > 0 ? (count / totalKeepers) * 100 : 0;
    return { ...config, count, percentage };
  });

  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/25 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm">Position Distribution</h3>
          <p className="text-xs text-slate-500">{totalKeepers} total keepers across all seasons</p>
        </div>
      </div>

      {/* Horizontal Stacked Bar */}
      <div className="mb-4">
        <div className="h-10 sm:h-12 rounded-lg overflow-hidden flex bg-[#131a28] border border-white/[0.04]">
          {positionData.map(({ position, color, percentage }) => {
            const isHovered = hoveredPosition === position;
            const isOtherHovered = hoveredPosition !== null && hoveredPosition !== position;

            return (
              <div
                key={position}
                className={`
                  relative flex items-center justify-center transition-all duration-300 cursor-pointer
                  ${color}
                  ${isHovered ? "brightness-110 z-10" : ""}
                  ${isOtherHovered ? "opacity-50" : ""}
                `}
                style={{ width: `${Math.max(percentage, 0)}%` }}
                onMouseEnter={() => setHoveredPosition(position)}
                onMouseLeave={() => setHoveredPosition(null)}
              >
                {percentage >= 10 && (
                  <span className={`
                    text-[10px] sm:text-xs font-bold text-white/90
                    transition-opacity duration-200
                    ${isOtherHovered ? "opacity-30" : ""}
                  `}>
                    {position} {Math.round(percentage)}%
                  </span>
                )}

                {/* Tooltip on hover for small segments */}
                {isHovered && percentage < 10 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 rounded text-[10px] text-white whitespace-nowrap z-20 border border-white/10">
                    {position} {Math.round(percentage)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Position Labels Grid */}
      <div className="grid grid-cols-4 gap-2">
        {positionData.map(({ position, count, bgColor, hoverBg, borderColor, textColor }) => {
          const isHovered = hoveredPosition === position;

          return (
            <div
              key={position}
              className={`
                text-center py-2.5 px-2 rounded-lg border transition-all duration-200 cursor-pointer
                ${bgColor} ${borderColor} ${hoverBg}
                ${isHovered ? "ring-2 ring-white/20 scale-[1.02]" : ""}
              `}
              onMouseEnter={() => setHoveredPosition(position)}
              onMouseLeave={() => setHoveredPosition(null)}
            >
              <div className={`text-lg sm:text-xl font-bold tabular-nums ${textColor}`}>
                {count}
              </div>
              <div className="text-[10px] text-slate-400 font-medium tracking-wide">
                {position}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

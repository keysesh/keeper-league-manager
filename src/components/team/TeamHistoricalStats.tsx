"use client";

import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/design-tokens";

interface BestSeason {
  season: number;
  wins: number;
  losses: number;
  points: number;
}

interface TeamHistoricalStatsProps {
  allTimeRecord: { wins: number; losses: number };
  totalPoints: number;
  bestSeason: BestSeason | null;
  seasonsPlayed: number;
  playoffAppearances: number;
  variant?: "full" | "compact";
  className?: string;
}

/**
 * Historical Stats Card showing all-time franchise statistics
 * Supports full and compact variants for Bento Grid layouts
 */
export function TeamHistoricalStats({
  allTimeRecord,
  totalPoints,
  bestSeason,
  seasonsPlayed,
  playoffAppearances,
  variant = "full",
  className,
}: TeamHistoricalStatsProps) {
  const totalGames = allTimeRecord.wins + allTimeRecord.losses;
  const winRate = totalGames > 0
    ? ((allTimeRecord.wins / totalGames) * 100).toFixed(1)
    : "0.0";

  const playoffRate = seasonsPlayed > 0
    ? Math.round((playoffAppearances / seasonsPlayed) * 100)
    : 0;

  if (variant === "compact") {
    return (
      <div className={cn("bg-[#0d1420] border border-white/[0.06] rounded-xl p-4", className)}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">All-Time Stats</h3>
        </div>

        {/* Compact 3-stat display */}
        <div className="space-y-3">
          {/* Main stat - Record */}
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
              {allTimeRecord.wins}-{allTimeRecord.losses}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              All-Time Record
            </div>
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#131a28] rounded-lg py-2 px-3 text-center border border-white/[0.04]">
              <div className="text-sm font-bold text-emerald-400 tabular-nums">{winRate}%</div>
              <div className="text-[9px] text-slate-500 uppercase">Win Rate</div>
            </div>
            <div className="bg-[#131a28] rounded-lg py-2 px-3 text-center border border-white/[0.04]">
              <div className="text-sm font-bold text-blue-400 tabular-nums">
                {totalPoints >= 1000 ? `${(totalPoints / 1000).toFixed(1)}k` : totalPoints.toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-500 uppercase">Points</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full variant (default)
  return (
    <div className={cn("bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden", className)}>
      <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-white">All-Time Stats</h2>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {/* Main stats - Large display */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Record */}
          <div className="bg-[#131a28] rounded-lg p-2.5 sm:p-3 text-center border border-white/[0.04]">
            <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
              {allTimeRecord.wins}-{allTimeRecord.losses}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
              Record
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-[#131a28] rounded-lg p-2.5 sm:p-3 text-center border border-white/[0.04]">
            <div className="text-lg sm:text-xl font-bold text-emerald-400 tabular-nums">
              {winRate}%
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
              Win Rate
            </div>
          </div>

          {/* Total Points */}
          <div className="bg-[#131a28] rounded-lg p-2.5 sm:p-3 text-center border border-white/[0.04]">
            <div className="text-lg sm:text-xl font-bold text-blue-400 tabular-nums">
              {totalPoints >= 1000
                ? `${(totalPoints / 1000).toFixed(1)}k`
                : totalPoints.toLocaleString()}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
              Points
            </div>
          </div>
        </div>

        {/* Compact secondary stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {bestSeason && (
            <div className="px-2 py-1.5 bg-[#131a28] rounded-md border border-white/[0.04]">
              <div className="text-xs font-medium text-amber-400">
                {bestSeason.wins}-{bestSeason.losses}
              </div>
              <div className="text-[9px] text-slate-500">Best ({bestSeason.season})</div>
            </div>
          )}
          <div className="px-2 py-1.5 bg-[#131a28] rounded-md border border-white/[0.04]">
            <div className="text-xs font-medium text-white">{seasonsPlayed}</div>
            <div className="text-[9px] text-slate-500">Seasons</div>
          </div>
          <div className="px-2 py-1.5 bg-[#131a28] rounded-md border border-white/[0.04]">
            <div className="text-xs font-medium text-purple-400">
              {playoffAppearances}
              <span className="text-slate-500 ml-0.5 text-[9px]">({playoffRate}%)</span>
            </div>
            <div className="text-[9px] text-slate-500">Playoffs</div>
          </div>
        </div>
      </div>
    </div>
  );
}

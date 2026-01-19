"use client";

import { TrendingUp, Target, Calendar, Award } from "lucide-react";

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
}

/**
 * Historical Stats Card showing all-time franchise statistics
 */
export function TeamHistoricalStats({
  allTimeRecord,
  totalPoints,
  bestSeason,
  seasonsPlayed,
  playoffAppearances,
}: TeamHistoricalStatsProps) {
  const totalGames = allTimeRecord.wins + allTimeRecord.losses;
  const winRate = totalGames > 0
    ? ((allTimeRecord.wins / totalGames) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white">All-Time Record</h2>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        {/* Main stats grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          {/* Record */}
          <div className="bg-[#131a28] rounded-lg p-3 text-center border border-white/[0.04]">
            <div className="text-xl sm:text-2xl font-bold text-white tabular-nums">
              {allTimeRecord.wins}-{allTimeRecord.losses}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider mt-1">
              Record
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-[#131a28] rounded-lg p-3 text-center border border-white/[0.04]">
            <div className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">
              {winRate}%
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider mt-1">
              Win Rate
            </div>
          </div>

          {/* Total Points */}
          <div className="bg-[#131a28] rounded-lg p-3 text-center border border-white/[0.04]">
            <div className="text-xl sm:text-2xl font-bold text-blue-400 tabular-nums">
              {totalPoints >= 1000
                ? `${(totalPoints / 1000).toFixed(1)}k`
                : totalPoints.toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider mt-1">
              Points
            </div>
          </div>
        </div>

        {/* Secondary stats */}
        <div className="space-y-2">
          {bestSeason && (
            <div className="flex items-center justify-between px-3 py-2 bg-[#131a28] rounded-lg border border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-slate-400">Best Season</span>
              </div>
              <div className="text-sm text-white font-medium">
                {bestSeason.season} ({bestSeason.wins}-{bestSeason.losses}, {bestSeason.points.toLocaleString()} pts)
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-3 py-2 bg-[#131a28] rounded-lg border border-white/[0.04]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Seasons Played</span>
            </div>
            <div className="text-sm text-white font-medium">{seasonsPlayed}</div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 bg-[#131a28] rounded-lg border border-white/[0.04]">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-slate-400">Playoff Appearances</span>
            </div>
            <div className="text-sm text-white font-medium">
              {playoffAppearances}
              {seasonsPlayed > 0 && (
                <span className="text-slate-500 ml-1">
                  ({Math.round((playoffAppearances / seasonsPlayed) * 100)}%)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

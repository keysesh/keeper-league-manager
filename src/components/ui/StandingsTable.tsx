"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { Crown, Medal, Trophy, ChevronRight } from "lucide-react";

interface RosterStanding {
  id: string;
  sleeperId: string;
  teamName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  isUserRoster: boolean;
  keeperCount: number;
  owners?: Array<{
    displayName: string;
    avatar: string | null;
  }>;
}

interface StandingsTableProps {
  rosters: RosterStanding[];
  leagueId: string;
  maxKeepers?: number;
  playoffSpots?: number;
}

export const StandingsTable = memo(function StandingsTable({
  rosters,
  leagueId,
  maxKeepers = 7,
  playoffSpots = 6,
}: StandingsTableProps) {
  // Sort by wins (desc), then points for (desc) - memoized
  const sorted = useMemo(() =>
    [...rosters].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointsFor - a.pointsFor;
    }),
    [rosters]
  );

  const maxPoints = useMemo(() => Math.max(...sorted.map((r) => r.pointsFor)), [sorted]);

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 border border-white/[0.06] shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] bg-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-white">Standings</h3>
          </div>
          <div className="flex items-center gap-6 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            <span className="w-12 text-center">W-L</span>
            <span className="w-16 text-right">Points</span>
            <span className="w-12 text-center">Keepers</span>
          </div>
        </div>
      </div>

      {/* Standings rows */}
      <div className="divide-y divide-white/[0.03]">
        {sorted.map((roster, index) => {
          const isPlayoff = index < playoffSpots;
          const pointsPercent = (roster.pointsFor / maxPoints) * 100;

          return (
            <Link
              key={roster.id}
              href={`/league/${leagueId}/team/${roster.id}`}
              className={`
                group relative flex items-center gap-3 px-4 py-3
                transition-all duration-200 ease-out
                hover:bg-white/[0.03]
                ${roster.isUserRoster ? "bg-gradient-to-r from-purple-500/[0.08] via-purple-500/[0.04] to-transparent" : ""}
              `}
            >
              {/* User team indicator line */}
              {roster.isUserRoster && (
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-purple-400 to-purple-600" />
              )}

              {/* Playoff line indicator */}
              {index === playoffSpots && (
                <div className="absolute left-4 right-4 -top-[1px] h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              )}

              {/* Rank badge */}
              <div className="w-8 flex-shrink-0">
                <RankBadge rank={index + 1} isPlayoff={isPlayoff} />
              </div>

              {/* Team avatar */}
              <div className={`
                w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                ${roster.isUserRoster
                  ? "bg-gradient-to-br from-purple-500/30 to-purple-600/20 ring-1 ring-purple-500/30"
                  : "bg-gradient-to-br from-zinc-700/50 to-zinc-800/50 ring-1 ring-white/[0.06]"
                }
                group-hover:ring-white/[0.12] transition-all
              `}>
                {roster.owners?.[0]?.avatar ? (
                  <img
                    src={`https://sleepercdn.com/avatars/${roster.owners[0].avatar}`}
                    alt=""
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <span className={`text-sm font-bold ${roster.isUserRoster ? "text-purple-400" : "text-zinc-500"}`}>
                    {(roster.teamName || "T")[0].toUpperCase()}
                  </span>
                )}
              </div>

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`
                    text-sm font-medium truncate
                    ${roster.isUserRoster ? "text-purple-200" : "text-white"}
                    group-hover:text-white transition-colors
                  `}>
                    {roster.teamName || `Team ${roster.sleeperId}`}
                  </span>
                  {roster.isUserRoster && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 uppercase tracking-wide">
                      You
                    </span>
                  )}
                </div>
                {roster.owners?.[0] && (
                  <span className="text-[11px] text-zinc-500 truncate block">
                    {roster.owners[0].displayName}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6">
                {/* Record */}
                <div className="w-12 text-center">
                  <span className={`
                    text-sm font-semibold tabular-nums
                    ${roster.wins > roster.losses ? "text-emerald-400" : ""}
                    ${roster.wins < roster.losses ? "text-red-400" : ""}
                    ${roster.wins === roster.losses ? "text-zinc-400" : ""}
                  `}>
                    {roster.wins}-{roster.losses}
                  </span>
                </div>

                {/* Points with mini bar */}
                <div className="w-16">
                  <div className="text-right">
                    <span className="text-sm font-medium text-zinc-300 tabular-nums">
                      {roster.pointsFor.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="h-1 mt-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        roster.isUserRoster
                          ? "bg-gradient-to-r from-purple-500 to-purple-400"
                          : "bg-gradient-to-r from-emerald-600 to-emerald-500"
                      }`}
                      style={{ width: `${pointsPercent}%` }}
                    />
                  </div>
                </div>

                {/* Keepers */}
                <div className="w-12 flex justify-center">
                  <KeeperBadge count={roster.keeperCount} max={maxKeepers} />
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer legend */}
      <div className="px-4 py-2.5 border-t border-white/[0.04] bg-black/20">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
              <span>Playoff spot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <span>Elimination zone</span>
            </div>
          </div>
          <span className="text-zinc-600">Top {playoffSpots} make playoffs</span>
        </div>
      </div>
    </div>
  );
});

const RankBadge = memo(function RankBadge({ rank, isPlayoff }: { rank: number; isPlayoff: boolean }) {
  if (rank === 1) {
    return (
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
        <Crown className="w-4 h-4 text-amber-900" />
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500 flex items-center justify-center shadow-lg shadow-zinc-400/20">
        <Medal className="w-4 h-4 text-zinc-700" />
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
        <Medal className="w-4 h-4 text-orange-900" />
      </div>
    );
  }

  return (
    <div className={`
      w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold
      ${isPlayoff
        ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
        : "bg-zinc-800/80 text-zinc-500 ring-1 ring-white/[0.04]"
      }
    `}>
      {rank}
    </div>
  );
});

const KeeperBadge = memo(function KeeperBadge({ count, max }: { count: number; max: number }) {
  const isFull = count >= max;
  const isEmpty = count === 0;
  const percent = (count / max) * 100;

  return (
    <div className={`
      relative px-2 py-1 rounded-lg text-xs font-semibold
      ${isFull ? "bg-emerald-500/15 text-emerald-400" : ""}
      ${isEmpty ? "bg-zinc-800/50 text-zinc-600" : ""}
      ${!isFull && !isEmpty ? "bg-purple-500/15 text-purple-400" : ""}
    `}>
      <span className="relative z-10">{count}/{max}</span>
      {!isEmpty && !isFull && (
        <div
          className="absolute inset-0 rounded-lg bg-purple-500/10"
          style={{
            clipPath: `inset(0 ${100 - percent}% 0 0)`,
          }}
        />
      )}
    </div>
  );
});

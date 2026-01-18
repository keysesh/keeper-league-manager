"use client";

import { useMemo } from "react";
import { Crown, Star, TrendingUp, Clock, Users } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";

interface HistoricalKeeper {
  season: number;
  playerId: string;
  playerName: string;
  position: string | null;
  team: string | null;
  type: "FRANCHISE" | "REGULAR";
  finalCost: number;
  yearsKept: number;
  rosterId: string;
  rosterName: string | null;
}

interface KeeperHistoryProps {
  keepers: HistoricalKeeper[];
  seasons?: number[];
}

/**
 * Historical Keeper Decisions visualization
 * Shows who kept who across multiple seasons
 */
export function KeeperHistory({ keepers, seasons }: KeeperHistoryProps) {
  const seasonList = useMemo(() => {
    if (seasons) return seasons.sort((a, b) => b - a);
    const uniqueSeasons = [...new Set(keepers.map(k => k.season))];
    return uniqueSeasons.sort((a, b) => b - a);
  }, [keepers, seasons]);

  const keepersBySeason = useMemo(() => {
    const grouped = new Map<number, HistoricalKeeper[]>();
    for (const season of seasonList) {
      grouped.set(season, keepers.filter(k => k.season === season));
    }
    return grouped;
  }, [keepers, seasonList]);

  // Find most kept players (across all seasons)
  const playerKeepCounts = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; franchiseCount: number }>();
    for (const keeper of keepers) {
      const existing = counts.get(keeper.playerId) || { name: keeper.playerName, count: 0, franchiseCount: 0 };
      existing.count++;
      if (keeper.type === "FRANCHISE") existing.franchiseCount++;
      counts.set(keeper.playerId, existing);
    }
    return [...counts.entries()]
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [keepers]);

  return (
    <div className="space-y-6">
      {/* Most Kept Players */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-white text-sm">Most Kept Players</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {playerKeepCounts.map((player, idx) => (
            <div
              key={player.id}
              className="bg-[#222] rounded-md p-2.5 text-center"
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                {idx === 0 && <Crown className="w-3 h-3 text-yellow-500" />}
                <span className="text-lg font-bold text-white">{player.count}</span>
              </div>
              <p className="text-xs text-gray-300 truncate">{player.name}</p>
              {player.franchiseCount > 0 && (
                <p className="text-[9px] text-purple-400 mt-0.5">
                  {player.franchiseCount}x franchise
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Season-by-Season View */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">Keeper History by Season</h3>
          </div>
        </div>

        <div className="divide-y divide-[#2a2a2a]">
          {seasonList.map((season) => {
            const seasonKeepers = keepersBySeason.get(season) || [];
            const franchiseCount = seasonKeepers.filter(k => k.type === "FRANCHISE").length;
            const regularCount = seasonKeepers.filter(k => k.type === "REGULAR").length;

            // Group by team
            const byTeam = new Map<string, HistoricalKeeper[]>();
            for (const keeper of seasonKeepers) {
              const teamKeepers = byTeam.get(keeper.rosterId) || [];
              teamKeepers.push(keeper);
              byTeam.set(keeper.rosterId, teamKeepers);
            }

            return (
              <div key={season} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{season}</span>
                    <span className="text-xs text-gray-500">Season</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400">
                      <span className="text-white font-medium">{seasonKeepers.length}</span> keepers
                    </span>
                    <span className="text-purple-400">
                      <Star className="w-3 h-3 inline mr-0.5" />
                      {franchiseCount} franchise
                    </span>
                    <span className="text-blue-400">{regularCount} regular</span>
                  </div>
                </div>

                {/* Teams grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[...byTeam.entries()].map(([rosterId, teamKeepers]) => (
                    <div key={rosterId} className="bg-[#222] rounded-md p-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Users className="w-3 h-3 text-gray-500" />
                        <span className="text-xs font-medium text-gray-300 truncate">
                          {teamKeepers[0].rosterName || `Team ${rosterId.slice(0, 6)}`}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {teamKeepers.map((keeper) => (
                          <div
                            key={keeper.playerId}
                            className="flex items-center gap-1.5 text-[10px]"
                          >
                            {keeper.type === "FRANCHISE" && (
                              <Star className="w-2.5 h-2.5 text-purple-400 fill-purple-400" />
                            )}
                            <PositionBadge position={keeper.position} size="xs" />
                            <span className="text-gray-300 truncate flex-1">{keeper.playerName}</span>
                            <span className="text-blue-400 font-medium">R{keeper.finalCost}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

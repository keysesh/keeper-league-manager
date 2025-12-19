"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";

// Team color palette - distinct colors for each team
const TEAM_COLORS = [
  { bg: "bg-rose-500", bgMuted: "bg-rose-500/20", border: "border-rose-500", text: "text-rose-300", accent: "text-rose-400" },
  { bg: "bg-sky-500", bgMuted: "bg-sky-500/20", border: "border-sky-500", text: "text-sky-300", accent: "text-sky-400" },
  { bg: "bg-emerald-500", bgMuted: "bg-emerald-500/20", border: "border-emerald-500", text: "text-emerald-300", accent: "text-emerald-400" },
  { bg: "bg-amber-500", bgMuted: "bg-amber-500/20", border: "border-amber-500", text: "text-amber-300", accent: "text-amber-400" },
  { bg: "bg-violet-500", bgMuted: "bg-violet-500/20", border: "border-violet-500", text: "text-violet-300", accent: "text-violet-400" },
  { bg: "bg-cyan-500", bgMuted: "bg-cyan-500/20", border: "border-cyan-500", text: "text-cyan-300", accent: "text-cyan-400" },
  { bg: "bg-pink-500", bgMuted: "bg-pink-500/20", border: "border-pink-500", text: "text-pink-300", accent: "text-pink-400" },
  { bg: "bg-lime-500", bgMuted: "bg-lime-500/20", border: "border-lime-500", text: "text-lime-300", accent: "text-lime-400" },
  { bg: "bg-orange-500", bgMuted: "bg-orange-500/20", border: "border-orange-500", text: "text-orange-300", accent: "text-orange-400" },
  { bg: "bg-teal-500", bgMuted: "bg-teal-500/20", border: "border-teal-500", text: "text-teal-300", accent: "text-teal-400" },
  { bg: "bg-indigo-500", bgMuted: "bg-indigo-500/20", border: "border-indigo-500", text: "text-indigo-300", accent: "text-indigo-400" },
  { bg: "bg-fuchsia-500", bgMuted: "bg-fuchsia-500/20", border: "border-fuchsia-500", text: "text-fuchsia-300", accent: "text-fuchsia-400" },
];

function getTeamColor(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

interface DraftSlot {
  rosterId: string;
  rosterName: string | null;
  status: "available" | "keeper" | "traded";
  keeper?: {
    playerId: string;
    playerName: string;
    position: string | null;
  };
  tradedTo?: string;
}

interface DraftBoardData {
  season: number;
  leagueId: string;
  totalRosters: number;
  draftRounds: number;
  cascade: Array<{
    rosterId: string;
    rosterName: string | null;
    results: Array<{
      playerId: string;
      playerName: string;
      position: string | null;
      team: string | null;
      baseCost: number;
      finalCost: number;
      cascaded: boolean;
      cascadeReason: string | null;
    }>;
    tradedAwayPicks: number[];
    acquiredPicks: Array<{ round: number; fromRosterId: string }>;
  }>;
  draftBoard: Array<{
    round: number;
    slots: DraftSlot[];
  }>;
  summary: {
    totalKeepers: number;
    cascadedKeepers: number;
    tradedPicks: number;
  };
}

interface PositionCount {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
}

export default function DraftBoardPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [data, setData] = useState<DraftBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchData();
  }, [leagueId]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/keepers/cascade`);
      if (!res.ok) throw new Error("Failed to fetch draft board");
      const result = await res.json();
      setData(result);
    } catch {
      setError("Failed to load draft board");
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall position summary
  const getOverallPositionSummary = (): PositionCount => {
    const counts: PositionCount = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
    if (!data) return counts;

    for (const team of data.cascade) {
      for (const keeper of team.results) {
        if (keeper.position) {
          const pos = keeper.position as keyof PositionCount;
          if (pos in counts) {
            counts[pos]++;
          }
        }
      }
    }
    return counts;
  };

  const overallPositions = getOverallPositionSummary();

  // Create comprehensive team info map - by rosterId AND by team name for traded picks
  const teamInfoMap = new Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>();
  const teamNameToInfo = new Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>();

  if (data) {
    const rosters = data.draftBoard[0]?.slots || [];
    rosters.forEach((roster, index) => {
      const info = {
        color: getTeamColor(index),
        name: roster.rosterName || `Team ${roster.rosterId.slice(0, 4)}`,
        rosterId: roster.rosterId,
      };
      teamInfoMap.set(roster.rosterId, info);
      // Also map by team name for traded picks lookup
      if (roster.rosterName) {
        teamNameToInfo.set(roster.rosterName, info);
      }
    });
  }

  if (loading) {
    return (
      <div className="max-w-full mx-auto space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-premium rounded-xl p-4">
              <Skeleton className="h-10 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <p className="text-red-400 font-medium">{error || "Failed to load data"}</p>
        </div>
      </div>
    );
  }

  const rosters = data.draftBoard[0]?.slots || [];

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link
            href={`/league/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-400 text-sm mb-3 transition-colors"
          >
            <span>&larr;</span>
            <span>Back to League</span>
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">Draft Board</h1>
          <p className="text-gray-500 mt-1">{data.season} Season</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === "grid"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === "list"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700"
            }`}
          >
            By Team
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
          <p className="text-3xl font-bold text-white">{data.summary.totalKeepers}</p>
          <p className="text-gray-500 text-xs mt-1">Total Keepers</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
          <p className="text-3xl font-bold text-amber-400">{data.summary.cascadedKeepers}</p>
          <p className="text-gray-500 text-xs mt-1">Cascaded</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
          <p className="text-3xl font-bold text-blue-400">{data.summary.tradedPicks}</p>
          <p className="text-gray-500 text-xs mt-1">Traded Picks</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
          <p className="text-3xl font-bold text-white">{data.totalRosters}</p>
          <p className="text-gray-500 text-xs mt-1">Teams</p>
        </div>
      </div>

      {/* Team Color Legend */}
      <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
        <div className="flex flex-wrap gap-2">
          {rosters.map((roster, index) => {
            const color = getTeamColor(index);
            const teamData = data.cascade.find(t => t.rosterId === roster.rosterId);
            const keeperCount = teamData?.results.length || 0;
            return (
              <div
                key={roster.rosterId}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/50"
              >
                <div className={`w-3 h-3 rounded-full ${color.bg}`} />
                <span className="text-gray-300 text-sm font-medium truncate max-w-[100px]">
                  {roster.rosterName || `Team ${roster.rosterId.slice(0, 4)}`}
                </span>
                <span className="text-gray-500 text-xs">({keeperCount})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Position Summary */}
      <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
        <div className="flex items-center gap-6">
          <span className="text-gray-500 text-sm font-medium">Keepers by Position:</span>
          <div className="flex gap-4">
            {(["QB", "RB", "WR", "TE"] as const).map((pos) => (
              <div key={pos} className="flex items-center gap-2">
                <PositionBadge position={pos} size="xs" />
                <span className="text-white font-semibold">{overallPositions[pos]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        /* Grid View - Clean Table */
        <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-900 px-3 py-3 text-left text-gray-400 text-sm font-semibold border-b border-gray-700 w-12">
                    Rd
                  </th>
                  {rosters.map((roster, index) => {
                    const color = getTeamColor(index);
                    return (
                      <th
                        key={roster.rosterId}
                        className="px-1 py-3 text-center border-b border-gray-700 min-w-[100px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                          <span className="text-gray-300 text-xs font-medium truncate max-w-[90px]">
                            {roster.rosterName || `Team ${roster.rosterId.slice(0, 4)}`}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.draftBoard.map((row, rowIndex) => (
                  <tr
                    key={row.round}
                    className={rowIndex % 2 === 0 ? "bg-gray-800/20" : "bg-transparent"}
                  >
                    <td className="sticky left-0 z-10 bg-gray-900 px-3 py-2 text-white font-bold text-sm border-r border-gray-800">
                      {row.round}
                    </td>
                    {row.slots.map((slot, slotIndex) => {
                      const columnColor = getTeamColor(slotIndex);
                      return (
                        <td key={slot.rosterId} className="px-1 py-1.5">
                          <DraftCell
                            slot={slot}
                            columnColor={columnColor}
                            teamInfoMap={teamInfoMap}
                            teamNameToInfo={teamNameToInfo}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* List View - By Team */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.cascade.map((team, index) => {
            const color = getTeamColor(index);
            return (
              <div
                key={team.rosterId}
                className="bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden"
              >
                {/* Team Header */}
                <div className={`${color.bgMuted} px-4 py-3 border-b ${color.border}/30`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color.bg}`} />
                      <span className={`font-semibold ${color.text}`}>
                        {team.rosterName || `Team ${team.rosterId.slice(0, 4)}`}
                      </span>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {team.results.length} keeper{team.results.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Keepers List */}
                <div className="p-3">
                  {team.results.length > 0 ? (
                    <div className="space-y-2">
                      {team.results
                        .sort((a, b) => a.finalCost - b.finalCost)
                        .map((keeper) => (
                          <div
                            key={keeper.playerId}
                            className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <PositionBadge position={keeper.position} size="xs" />
                              <span className="text-white text-sm font-medium truncate">
                                {keeper.playerName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {keeper.cascaded ? (
                                <>
                                  <span className="text-gray-500 text-xs line-through">R{keeper.baseCost}</span>
                                  <span className="text-amber-400 text-sm font-bold">R{keeper.finalCost}</span>
                                </>
                              ) : (
                                <span className="text-white text-sm font-bold">R{keeper.finalCost}</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-4">No keepers selected</p>
                  )}

                  {/* Traded Picks */}
                  {(team.tradedAwayPicks.length > 0 || team.acquiredPicks.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-1">
                      {team.tradedAwayPicks.length > 0 && (
                        <p className="text-red-400/80 text-xs">
                          Traded: R{team.tradedAwayPicks.join(", R")}
                        </p>
                      )}
                      {team.acquiredPicks.length > 0 && (
                        <p className="text-green-400/80 text-xs">
                          Acquired: R{team.acquiredPicks.map((p) => p.round).join(", R")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-emerald-500/30 border border-emerald-500/50" />
          <span>Keeper</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border-2 border-dashed border-sky-500/50 bg-sky-500/10" />
          <span>Traded Pick</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gray-700/30 border border-gray-600/30" />
          <span>Available</span>
        </div>
      </div>
    </div>
  );
}

interface DraftCellProps {
  slot: DraftSlot;
  columnColor: ReturnType<typeof getTeamColor>;
  teamInfoMap: Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>;
  teamNameToInfo: Map<string, { color: ReturnType<typeof getTeamColor>; name: string; rosterId: string }>;
}

function DraftCell({ slot, columnColor, teamInfoMap, teamNameToInfo }: DraftCellProps) {
  // Traded away - show who now owns this pick with THEIR color
  if (slot.status === "traded" && slot.tradedTo) {
    // Try to find the new owner by name first, then by rosterId
    let newOwnerInfo = teamNameToInfo.get(slot.tradedTo) || teamInfoMap.get(slot.tradedTo);

    // If still not found, try to find by partial match
    if (!newOwnerInfo) {
      for (const [name, info] of teamNameToInfo) {
        if (name.includes(slot.tradedTo) || slot.tradedTo.includes(name)) {
          newOwnerInfo = info;
          break;
        }
      }
    }

    const ownerColor = newOwnerInfo?.color || columnColor;
    const ownerName = newOwnerInfo?.name || slot.tradedTo;

    return (
      <div
        className={`${ownerColor.bgMuted} border-2 border-dashed ${ownerColor.border}/50 rounded-lg px-1.5 py-2 text-center h-[52px] flex flex-col justify-center`}
      >
        <p className={`${ownerColor.accent} text-[10px] font-semibold truncate`}>
          {ownerName}
        </p>
        <p className="text-gray-500 text-[9px]">owns pick</p>
      </div>
    );
  }

  // Keeper in this slot - use column team's color
  if (slot.status === "keeper" && slot.keeper) {
    return (
      <div
        className={`${columnColor.bgMuted} border ${columnColor.border}/50 rounded-lg px-1.5 py-1.5 h-[52px] flex flex-col justify-center`}
      >
        <div className="flex items-center justify-center">
          <PositionBadge position={slot.keeper.position} size="xs" />
        </div>
        <p className={`${columnColor.text} text-[10px] font-medium truncate text-center mt-0.5`}>
          {slot.keeper.playerName}
        </p>
      </div>
    );
  }

  // Available pick - muted version of column team's color
  return (
    <div
      className="bg-gray-800/20 border border-gray-700/30 rounded-lg h-[52px] flex items-center justify-center"
    >
      <span className="text-gray-600 text-xs">—</span>
    </div>
  );
}

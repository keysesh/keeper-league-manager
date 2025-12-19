"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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

interface TeamStatus {
  rosterId: string;
  rosterName: string | null;
  keeperCount: number;
  maxKeepers: number;
  status: "ready" | "planning" | "empty";
}

export default function DraftBoardPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [data, setData] = useState<DraftBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showPositionSummary, setShowPositionSummary] = useState(true);

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

  // Calculate position counts by round
  const getPositionCountsByRound = (round: number): PositionCount => {
    const counts: PositionCount = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
    if (!data) return counts;

    const row = data.draftBoard.find(r => r.round === round);
    if (!row) return counts;

    for (const slot of row.slots) {
      if (slot.status === "keeper" && slot.keeper?.position) {
        const pos = slot.keeper.position as keyof PositionCount;
        if (pos in counts) {
          counts[pos]++;
        }
      }
    }
    return counts;
  };

  // Calculate team statuses
  const getTeamStatuses = (): TeamStatus[] => {
    if (!data) return [];

    return data.cascade.map(team => ({
      rosterId: team.rosterId,
      rosterName: team.rosterName,
      keeperCount: team.results.length,
      maxKeepers: 7, // From keeper settings
      status: team.results.length === 0
        ? "empty"
        : team.results.length >= 7
          ? "ready"
          : "planning" as const,
    }));
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

  const teamStatuses = getTeamStatuses();
  const overallPositions = getOverallPositionSummary();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error || "Failed to load data"}</p>
        </div>
      </div>
    );
  }

  // Get unique rosters for column headers
  const rosters = data.draftBoard[0]?.slots || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/league/${leagueId}`}
            className="text-gray-400 hover:text-white text-sm mb-2 inline-block"
          >
            &larr; Back to League
          </Link>
          <h1 className="text-2xl font-bold text-white">Draft Board</h1>
          <p className="text-gray-400 mt-1">{data.season} Season</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowPositionSummary(!showPositionSummary)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              showPositionSummary
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            Position Summary
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              viewMode === "grid"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            Grid View
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              viewMode === "list"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            List View
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <p className="text-3xl font-bold text-white">{data.summary.totalKeepers}</p>
          <p className="text-gray-400 text-sm">Total Keepers</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <p className="text-3xl font-bold text-yellow-400">{data.summary.cascadedKeepers}</p>
          <p className="text-gray-400 text-sm">Cascaded Picks</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <p className="text-3xl font-bold text-blue-400">{data.summary.tradedPicks}</p>
          <p className="text-gray-400 text-sm">Traded Picks</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <p className="text-3xl font-bold text-green-400">
            {teamStatuses.filter(t => t.status === "ready").length}/{teamStatuses.length}
          </p>
          <p className="text-gray-400 text-sm">Teams Ready</p>
        </div>
      </div>

      {/* Position Scarcity Overview */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400">Position Breakdown</h3>
          <span className="text-xs text-gray-500">Keepers by position league-wide</span>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
          {(["QB", "RB", "WR", "TE", "K", "DEF"] as const).map((pos) => (
            <div key={pos} className="text-center">
              <PositionBadge position={pos} />
              <p className="text-xl font-bold text-white mt-1">{overallPositions[pos]}</p>
              <p className="text-xs text-gray-500">
                {data.totalRosters > 0
                  ? `${((overallPositions[pos] / data.totalRosters) * 100).toFixed(0)}%`
                  : "0%"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Status Indicators */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Team Status</h3>
        <div className="flex flex-wrap gap-2">
          {teamStatuses.map((team) => (
            <div
              key={team.rosterId}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                team.status === "ready"
                  ? "bg-green-500/20 border border-green-500/40 text-green-400"
                  : team.status === "planning"
                  ? "bg-yellow-500/20 border border-yellow-500/40 text-yellow-400"
                  : "bg-gray-700/50 border border-gray-600/40 text-gray-400"
              }`}
            >
              <span className="truncate max-w-[100px]">
                {team.rosterName || `Team ${team.rosterId.slice(0, 4)}`}
              </span>
              <span className="text-xs opacity-75">
                {team.keeperCount}/{team.maxKeepers}
              </span>
            </div>
          ))}
        </div>
      </div>

      {viewMode === "grid" ? (
        /* Grid View */
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-900">
                  <th className="sticky left-0 bg-gray-900 z-10 px-3 py-3 text-left text-gray-400 text-sm font-medium border-b border-gray-700 w-16">
                    Rd
                  </th>
                  {showPositionSummary && (
                    <th className="px-2 py-3 text-center text-gray-400 text-xs font-medium border-b border-gray-700 min-w-[100px] bg-gray-900/80">
                      Pos Summary
                    </th>
                  )}
                  {rosters.map((roster) => {
                    const teamStatus = teamStatuses.find(t => t.rosterId === roster.rosterId);
                    return (
                      <th
                        key={roster.rosterId}
                        className="px-2 py-3 text-center text-gray-400 text-xs font-medium border-b border-gray-700 min-w-[120px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="truncate block max-w-[100px]">
                            {roster.rosterName || `Team ${roster.rosterId.slice(0, 4)}`}
                          </span>
                          {teamStatus && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                teamStatus.status === "ready"
                                  ? "bg-green-500/30 text-green-400"
                                  : teamStatus.status === "planning"
                                  ? "bg-yellow-500/30 text-yellow-400"
                                  : "bg-gray-600/30 text-gray-500"
                              }`}
                            >
                              {teamStatus.keeperCount}/{teamStatus.maxKeepers}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.draftBoard.map((row) => {
                  const positionCounts = getPositionCountsByRound(row.round);
                  const hasKeepers = Object.values(positionCounts).some(c => c > 0);
                  return (
                    <tr key={row.round} className="border-b border-gray-700/50">
                      <td className="sticky left-0 bg-gray-800 z-10 px-3 py-2 text-gray-400 font-medium border-r border-gray-700">
                        {row.round}
                      </td>
                      {showPositionSummary && (
                        <td className="px-1 py-1 bg-gray-800/50">
                          {hasKeepers ? (
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {(["QB", "RB", "WR", "TE"] as const).map((pos) =>
                                positionCounts[pos] > 0 ? (
                                  <span
                                    key={pos}
                                    className={`text-[10px] px-1 rounded ${
                                      pos === "QB"
                                        ? "bg-red-500/30 text-red-400"
                                        : pos === "RB"
                                        ? "bg-green-500/30 text-green-400"
                                        : pos === "WR"
                                        ? "bg-blue-500/30 text-blue-400"
                                        : "bg-orange-500/30 text-orange-400"
                                    }`}
                                  >
                                    {positionCounts[pos]}{pos}
                                  </span>
                                ) : null
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                      )}
                      {row.slots.map((slot) => (
                        <td key={slot.rosterId} className="px-1 py-1">
                          <DraftCell slot={slot} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* List View - By Team */
        <div className="space-y-4">
          {data.cascade.map((team) => (
            <div
              key={team.rosterId}
              className="bg-gray-800/50 rounded-xl p-6 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {team.rosterName || `Team ${team.rosterId.slice(0, 4)}`}
                </h3>
                <span className="text-gray-400 text-sm">
                  {team.results.length} keeper{team.results.length !== 1 ? "s" : ""}
                </span>
              </div>

              {team.results.length > 0 ? (
                <div className="space-y-2">
                  {team.results.map((keeper) => (
                    <div
                      key={keeper.playerId}
                      className="flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <PositionBadge position={keeper.position} />
                        <div>
                          <p className="text-white">{keeper.playerName}</p>
                          <p className="text-gray-500 text-sm">{keeper.team || "FA"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {keeper.cascaded ? (
                          <div className="text-right">
                            <p className="text-white">
                              Round{" "}
                              <span className="line-through text-gray-500">
                                {keeper.baseCost}
                              </span>{" "}
                              <span className="text-yellow-400">{keeper.finalCost}</span>
                            </p>
                            <p className="text-yellow-400/70 text-xs">Cascaded</p>
                          </div>
                        ) : (
                          <p className="text-white">Round {keeper.finalCost}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No keepers selected</p>
              )}

              {/* Traded Picks Info */}
              {(team.tradedAwayPicks.length > 0 || team.acquiredPicks.length > 0) && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  {team.tradedAwayPicks.length > 0 && (
                    <p className="text-red-400 text-sm">
                      Traded Away: Rounds {team.tradedAwayPicks.join(", ")}
                    </p>
                  )}
                  {team.acquiredPicks.length > 0 && (
                    <p className="text-green-400 text-sm">
                      Acquired: Rounds {team.acquiredPicks.map((p) => p.round).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-500/30 border border-purple-500" />
            <span className="text-gray-300">Keeper</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/30 border border-yellow-500" />
            <span className="text-gray-300">Cascaded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500" />
            <span className="text-gray-300">Traded Away</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-700 border border-gray-600" />
            <span className="text-gray-300">Available</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftCell({ slot }: { slot: DraftSlot }) {
  if (slot.status === "traded") {
    return (
      <div className="bg-red-500/20 border border-red-500/40 rounded px-2 py-1.5 text-center min-h-[50px] flex flex-col justify-center">
        <p className="text-red-400 text-xs truncate">Traded to</p>
        <p className="text-red-300 text-xs truncate">{slot.tradedTo}</p>
      </div>
    );
  }

  if (slot.status === "keeper" && slot.keeper) {
    return (
      <div className="bg-purple-500/20 border border-purple-500/40 rounded px-2 py-1.5 text-center min-h-[50px] flex flex-col justify-center">
        <div className="flex items-center justify-center gap-1">
          <PositionBadge position={slot.keeper.position} small />
        </div>
        <p className="text-white text-xs truncate mt-1">{slot.keeper.playerName}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-700/30 border border-gray-600/30 rounded px-2 py-1.5 text-center min-h-[50px] flex items-center justify-center">
      <span className="text-gray-600 text-xs">Open</span>
    </div>
  );
}

function PositionBadge({ position, small = false }: { position: string | null; small?: boolean }) {
  const colors: Record<string, string> = {
    QB: "bg-red-500/30 text-red-400",
    RB: "bg-green-500/30 text-green-400",
    WR: "bg-blue-500/30 text-blue-400",
    TE: "bg-orange-500/30 text-orange-400",
    K: "bg-purple-500/30 text-purple-400",
    DEF: "bg-gray-500/30 text-gray-400",
  };

  return (
    <span
      className={`inline-block rounded font-medium ${
        small ? "px-1 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${colors[position || ""] || "bg-gray-500/30 text-gray-400"}`}
    >
      {position || "?"}
    </span>
  );
}

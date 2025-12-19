"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";

interface KeeperHistory {
  id: string;
  season: number;
  type: string;
  baseCost: number;
  finalCost: number;
  yearsKept: number;
  player: {
    id: string;
    fullName: string;
    position: string | null;
    team: string | null;
  };
  roster: {
    id: string;
    teamName: string | null;
  };
}

interface SeasonStats {
  season: number;
  totalKeepers: number;
  franchiseTags: number;
  regularKeepers: number;
  avgCost: number;
  mostKeptPosition: string;
}

export default function HistoryPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [history, setHistory] = useState<KeeperHistory[]>([]);
  const [stats, setStats] = useState<SeasonStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSeason, setSelectedSeason] = useState<number | "all">("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");

  const [teams, setTeams] = useState<{ id: string; teamName: string | null }[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [leagueId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/history`);
      if (!res.ok) throw new Error("Failed to fetch keeper history");
      const data = await res.json();

      setTeams(
        data.teams.map((r: { id: string; teamName: string | null }) => ({
          id: r.id,
          teamName: r.teamName,
        }))
      );

      setHistory(data.keepers || []);
      setStats(data.seasonStats || []);
    } catch {
      setError("Failed to load keeper history");
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter((k) => {
    if (selectedSeason !== "all" && k.season !== selectedSeason) return false;
    if (selectedTeam !== "all" && k.roster.id !== selectedTeam) return false;
    return true;
  });

  const seasons = [...new Set(history.map((k) => k.season))].sort(
    (a, b) => b - a
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-premium rounded-2xl p-6">
              <Skeleton className="h-8 w-16 mb-4" />
              <Skeleton className="h-4 w-24 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/league/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-400 text-sm mb-4 transition-colors"
        >
          <span>&larr;</span>
          <span>Back to League</span>
        </Link>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Keeper History</h1>
        <p className="text-gray-500 mt-2 text-lg">
          View historical keeper data and trends
        </p>
      </div>

      {/* Season Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.season}
            className="card-premium rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{s.season}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
                Season
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Total Keepers</span>
                <span className="text-white font-bold text-lg">{s.totalKeepers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Franchise Tags</span>
                <span className="badge-franchise">{s.franchiseTags}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Regular Keepers</span>
                <span className="badge-keeper">{s.regularKeepers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Avg Cost</span>
                <span className="text-white font-semibold">Rd {s.avgCost}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Top Position</span>
                <PositionBadge position={s.mostKeptPosition} size="sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
          Filters
        </h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-semibold text-gray-400 mb-2">Season</label>
            <select
              value={selectedSeason}
              onChange={(e) =>
                setSelectedSeason(
                  e.target.value === "all" ? "all" : parseInt(e.target.value)
                )
              }
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
            >
              <option value="all">All Seasons</option>
              {seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-semibold text-gray-400 mb-2">Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
            >
              <option value="all">All Teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.teamName || `Team ${team.id.slice(0, 4)}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Keeper History Table */}
      <div className="card-premium rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
            All Keepers
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({filteredHistory.length} records)
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900/50">
                <th className="px-6 py-4 text-left text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  Season
                </th>
                <th className="px-6 py-4 text-left text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-4 text-left text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-4 text-center text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-center text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-4 text-center text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  Years Kept
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((keeper) => (
                  <tr
                    key={keeper.id}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="text-white font-semibold">{keeper.season}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <PositionBadge position={keeper.player.position} size="sm" />
                        <div>
                          <p className="text-white font-medium">{keeper.player.fullName}</p>
                          <p className="text-gray-500 text-sm">
                            {keeper.player.team || "FA"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300 font-medium">
                        {keeper.roster.teamName || "Unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {keeper.type === "FRANCHISE" ? (
                        <span className="badge-franchise">FT</span>
                      ) : (
                        <span className="badge-keeper">K</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {keeper.baseCost !== keeper.finalCost ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="line-through text-gray-600 text-sm">
                            {keeper.baseCost}
                          </span>
                          <span className="text-amber-400 font-bold">
                            {keeper.finalCost}
                          </span>
                        </div>
                      ) : (
                        <span className="text-white font-semibold">{keeper.finalCost}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 font-bold">
                        {keeper.yearsKept}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No keeper history found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Position Trends */}
      {history.length > 0 && (
        <div className="card-premium rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-green-500 rounded-full"></span>
            Position Trends
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {["QB", "RB", "WR", "TE"].map((position) => {
              const count = filteredHistory.filter(
                (k) => k.player.position === position
              ).length;
              const percentage =
                filteredHistory.length > 0
                  ? Math.round((count / filteredHistory.length) * 100)
                  : 0;

              return (
                <div key={position} className="text-center p-4 rounded-xl bg-gray-800/30">
                  <PositionBadge position={position} size="md" />
                  <p className="text-3xl font-extrabold text-white mt-3">{count}</p>
                  <p className="text-gray-500 text-sm mt-1">{percentage}% of keepers</p>
                  <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        position === "QB" ? "bg-red-500" :
                        position === "RB" ? "bg-green-500" :
                        position === "WR" ? "bg-blue-500" :
                        "bg-orange-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Year Keepers */}
      {history.length > 0 && (
        <div className="card-premium rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-amber-500 rounded-full"></span>
            Multi-Year Keepers
            <span className="text-sm font-normal text-gray-500 ml-2">
              (Players kept 2+ years)
            </span>
          </h2>
          <div className="space-y-3">
            {filteredHistory
              .filter((k) => k.yearsKept > 1)
              .sort((a, b) => b.yearsKept - a.yearsKept)
              .slice(0, 10)
              .map((keeper) => (
                <div
                  key={keeper.id}
                  className="flex items-center justify-between bg-gray-800/30 rounded-xl px-5 py-4 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <PositionBadge position={keeper.player.position} size="sm" />
                    <div>
                      <p className="text-white font-semibold">{keeper.player.fullName}</p>
                      <p className="text-gray-500 text-sm">
                        {keeper.roster.teamName} &bull; {keeper.season}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-400 font-bold text-lg">
                      {keeper.yearsKept} years
                    </p>
                    <p className="text-gray-500 text-sm">
                      Round {keeper.finalCost}
                    </p>
                  </div>
                </div>
              ))}
            {filteredHistory.filter((k) => k.yearsKept > 1).length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No multi-year keepers found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

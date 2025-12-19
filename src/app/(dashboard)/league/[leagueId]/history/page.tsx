"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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
      // Fetch all keeper history from the new API endpoint
      const res = await fetch(`/api/leagues/${leagueId}/history`);
      if (!res.ok) throw new Error("Failed to fetch keeper history");
      const data = await res.json();

      // Set teams from the response
      setTeams(
        data.teams.map((r: { id: string; teamName: string | null }) => ({
          id: r.id,
          teamName: r.teamName,
        }))
      );

      // Set keepers from the response
      setHistory(data.keepers || []);

      // Set stats from the response (already calculated by the API)
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/league/${leagueId}`}
          className="text-gray-400 hover:text-white text-sm mb-2 inline-block"
        >
          &larr; Back to League
        </Link>
        <h1 className="text-2xl font-bold text-white">Keeper History</h1>
        <p className="text-gray-400 mt-1">
          View historical keeper data and trends
        </p>
      </div>

      {/* Season Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.season}
            className="bg-gray-800/50 rounded-xl p-6 border border-gray-700"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              {s.season} Season
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Keepers</span>
                <span className="text-white font-medium">{s.totalKeepers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Franchise Tags</span>
                <span className="text-yellow-400 font-medium">
                  {s.franchiseTags}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Regular Keepers</span>
                <span className="text-blue-400 font-medium">
                  {s.regularKeepers}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Cost</span>
                <span className="text-white font-medium">
                  Round {s.avgCost}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Most Kept Position</span>
                <span className="text-purple-400 font-medium">
                  {s.mostKeptPosition}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Season</label>
            <select
              value={selectedSeason}
              onChange={(e) =>
                setSelectedSeason(
                  e.target.value === "all" ? "all" : parseInt(e.target.value)
                )
              }
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value="all">All Seasons</option>
              {seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900">
                <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">
                  Season
                </th>
                <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">
                  Player
                </th>
                <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">
                  Team
                </th>
                <th className="px-4 py-3 text-center text-gray-400 text-sm font-medium">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-gray-400 text-sm font-medium">
                  Cost
                </th>
                <th className="px-4 py-3 text-center text-gray-400 text-sm font-medium">
                  Years Kept
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length > 0 ? (
                filteredHistory.map((keeper) => (
                  <tr
                    key={keeper.id}
                    className="border-t border-gray-700/50 hover:bg-gray-700/20"
                  >
                    <td className="px-4 py-3 text-gray-300">{keeper.season}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <PositionBadge position={keeper.player.position} />
                        <div>
                          <p className="text-white">{keeper.player.fullName}</p>
                          <p className="text-gray-500 text-sm">
                            {keeper.player.team || "FA"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {keeper.roster.teamName || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          keeper.type === "FRANCHISE"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {keeper.type === "FRANCHISE" ? "FT" : "Regular"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-white">
                      {keeper.baseCost !== keeper.finalCost ? (
                        <>
                          <span className="line-through text-gray-500">
                            {keeper.baseCost}
                          </span>{" "}
                          <span className="text-yellow-400">
                            {keeper.finalCost}
                          </span>
                        </>
                      ) : (
                        keeper.finalCost
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">
                      {keeper.yearsKept}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No keeper history found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Keeper Trends */}
      {history.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Position Trends
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["QB", "RB", "WR", "TE"].map((position) => {
              const count = filteredHistory.filter(
                (k) => k.player.position === position
              ).length;
              const percentage =
                filteredHistory.length > 0
                  ? Math.round((count / filteredHistory.length) * 100)
                  : 0;

              return (
                <div key={position} className="text-center">
                  <PositionBadge position={position} />
                  <p className="text-2xl font-bold text-white mt-2">{count}</p>
                  <p className="text-gray-500 text-sm">{percentage}% of keepers</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Year Keepers */}
      {history.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Multi-Year Keepers
          </h2>
          <div className="space-y-2">
            {filteredHistory
              .filter((k) => k.yearsKept > 1)
              .sort((a, b) => b.yearsKept - a.yearsKept)
              .slice(0, 10)
              .map((keeper) => (
                <div
                  key={keeper.id}
                  className="flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <PositionBadge position={keeper.player.position} />
                    <div>
                      <p className="text-white">{keeper.player.fullName}</p>
                      <p className="text-gray-500 text-sm">
                        {keeper.roster.teamName} - {keeper.season}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-400 font-medium">
                      {keeper.yearsKept} years
                    </p>
                    <p className="text-gray-500 text-sm">
                      Round {keeper.finalCost}
                    </p>
                  </div>
                </div>
              ))}
            {filteredHistory.filter((k) => k.yearsKept > 1).length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No multi-year keepers found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PositionBadge({ position }: { position: string | null }) {
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
      className={`inline-block w-10 text-center px-2 py-1 rounded text-xs font-medium ${
        colors[position || ""] || "bg-gray-500/30 text-gray-400"
      }`}
    >
      {position || "?"}
    </span>
  );
}

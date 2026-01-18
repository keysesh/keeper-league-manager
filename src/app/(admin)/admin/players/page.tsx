"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { PositionBadge, RookieBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { Skeleton } from "@/components/ui/Skeleton";

/** Get the most recent NFL season with available data */
function getCurrentSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Before September, previous year's season is most recent with data
  return month >= 8 ? year : year - 1;
}

/** Get the upcoming NFL season for projections */
function getUpcomingSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Before September, current year is upcoming; after September, next year
  return month >= 8 ? year + 1 : year;
}

interface Player {
  id: string;
  sleeperId: string;
  fullName: string;
  position: string | null;
  team: string | null;
  yearsExp: number | null;
  status: string | null;
}

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingNflverse, setSyncingNflverse] = useState(false);
  const [syncingProjections, setSyncingProjections] = useState(false);
  const [syncingRankings, setSyncingRankings] = useState(false);
  const [syncingDepthCharts, setSyncingDepthCharts] = useState(false);
  const [syncingInjuries, setSyncingInjuries] = useState(false);
  const [syncingSchedule, setSyncingSchedule] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const { success, error } = useToast();

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        ...(search && { search }),
        ...(position && { position }),
      });
      const res = await fetch(`/api/admin/players?${params}`);
      const data = await res.json();
      setPlayers(data.players || []);
      setTotal(data.total || 0);
    } catch {
      error("Failed to fetch players");
    } finally {
      setLoading(false);
    }
  };

  const syncPlayers = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sleeper/sync/players", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        success(`Synced ${data.total} players`);
        fetchPlayers();
      } else {
        error(data.error || "Sync failed");
      }
    } catch {
      error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const syncNflverseStats = async () => {
    setSyncingNflverse(true);
    try {
      // No season param - API defaults to most recent season with data
      const res = await fetch("/api/nflverse/sync?type=stats", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const playersUpdated = data.result?.stats?.playersUpdated || 0;
        const season = data.season || getCurrentSeason();
        success(`Synced ${playersUpdated} player stats from ${season} season`);
      } else {
        error(data.error || "NFLverse sync failed");
      }
    } catch {
      error("NFLverse sync failed");
    } finally {
      setSyncingNflverse(false);
    }
  };

  const syncProjections = async () => {
    setSyncingProjections(true);
    try {
      // No season param - API defaults to upcoming season
      const res = await fetch("/api/nflverse/sync?type=projections", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const playersUpdated = data.result?.projections?.playersUpdated || 0;
        const errors = data.result?.projections?.errors || [];
        const season = data.season || getUpcomingSeason();
        if (playersUpdated > 0) {
          success(`Synced ${playersUpdated} player projections for ${season}`);
        } else if (errors.length > 0) {
          error(errors[0]);
        } else {
          error(`No projections available for ${season} yet`);
        }
      } else {
        error(data.error || "Projections sync failed");
      }
    } catch {
      error("Projections sync failed");
    } finally {
      setSyncingProjections(false);
    }
  };

  const syncRankings = async () => {
    setSyncingRankings(true);
    try {
      const res = await fetch("/api/nflverse/sync?type=rankings", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const playersUpdated = data.result?.rankings?.playersUpdated || 0;
        if (playersUpdated > 0) {
          success(`Synced ${playersUpdated} player rankings`);
        } else {
          error("No rankings data available");
        }
      } else {
        error(data.error || "Rankings sync failed");
      }
    } catch {
      error("Rankings sync failed");
    } finally {
      setSyncingRankings(false);
    }
  };

  const syncDepthCharts = async () => {
    setSyncingDepthCharts(true);
    try {
      const res = await fetch("/api/nflverse/sync?type=depth_charts", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const playersUpdated = data.result?.depthCharts?.playersUpdated || 0;
        const season = data.season || getCurrentSeason();
        if (playersUpdated > 0) {
          success(`Synced ${playersUpdated} depth chart entries for ${season}`);
        } else {
          error(`No depth chart data available for ${season}`);
        }
      } else {
        error(data.error || "Depth charts sync failed");
      }
    } catch {
      error("Depth charts sync failed");
    } finally {
      setSyncingDepthCharts(false);
    }
  };

  const syncInjuriesData = async () => {
    setSyncingInjuries(true);
    try {
      const res = await fetch("/api/nflverse/sync?type=injuries", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const playersUpdated = data.result?.injuries?.playersUpdated || 0;
        const season = data.season || getCurrentSeason();
        if (playersUpdated > 0) {
          success(`Synced ${playersUpdated} injury reports for ${season}`);
        } else {
          error(`No injury data available for ${season} (may not be published yet)`);
        }
      } else {
        error(data.error || "Injuries sync failed");
      }
    } catch {
      error("Injuries sync failed");
    } finally {
      setSyncingInjuries(false);
    }
  };

  const syncScheduleData = async () => {
    setSyncingSchedule(true);
    try {
      // Default to upcoming season (current year)
      const upcomingSeason = new Date().getFullYear();
      const res = await fetch(`/api/nflverse/sync?type=schedule&season=${upcomingSeason}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const schedule = data.result?.schedule;
        const teams = schedule?.teamsProcessed || 0;
        const games = schedule?.gamesProcessed || 0;
        const season = schedule?.season || upcomingSeason;
        const scheduleErrors = schedule?.errors || [];
        if (teams > 0) {
          success(`Synced ${season} schedule: ${teams} teams, ${games} games`);
        } else if (scheduleErrors.length > 0) {
          // Show the specific error (e.g., "schedule not yet released")
          error(scheduleErrors[0]);
        } else {
          error(`No schedule data available for ${season}`);
        }
      } else {
        error(data.error || "Schedule sync failed");
      }
    } catch {
      error("Schedule sync failed");
    } finally {
      setSyncingSchedule(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Player Management</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={syncPlayers}
            disabled={syncing}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium"
          >
            {syncing ? "Syncing..." : "Sync Players"}
          </button>
          <button
            onClick={syncNflverseStats}
            disabled={syncingNflverse}
            className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium"
          >
            {syncingNflverse ? "Syncing..." : "Stats"}
          </button>
          <button
            onClick={syncProjections}
            disabled={syncingProjections}
            className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium"
          >
            {syncingProjections ? "Syncing..." : "Projections"}
          </button>
          <button
            onClick={syncRankings}
            disabled={syncingRankings}
            className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium"
          >
            {syncingRankings ? "Syncing..." : "Rankings"}
          </button>
          <button
            onClick={syncDepthCharts}
            disabled={syncingDepthCharts}
            className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium"
          >
            {syncingDepthCharts ? "Syncing..." : "Depth Charts"}
          </button>
          <button
            onClick={syncInjuriesData}
            disabled={syncingInjuries}
            className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium"
          >
            {syncingInjuries ? "Syncing..." : "Injuries"}
          </button>
          <button
            onClick={syncScheduleData}
            disabled={syncingSchedule}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium"
          >
            {syncingSchedule ? "Syncing..." : "Schedule"}
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Positions</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
            <option value="K">K</option>
            <option value="DEF">DEF</option>
          </select>
          <button
            onClick={fetchPlayers}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
          >
            Search
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <span className="text-gray-400">
            {total > 0 ? `${total.toLocaleString()} players` : "Click Search to load players"}
          </span>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-gray-400 font-medium">Player</th>
                <th className="px-4 py-3 text-gray-400 font-medium">Position</th>
                <th className="px-4 py-3 text-gray-400 font-medium">Team</th>
                <th className="px-4 py-3 text-gray-400 font-medium">Exp</th>
                <th className="px-4 py-3 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-gray-800 hover:bg-gray-850">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />
                      <span className="text-white">{player.fullName}</span>
                      {player.yearsExp === 0 && <RookieBadge size="xs" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PositionBadge position={player.position} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-gray-400">{player.team || "FA"}</td>
                  <td className="px-4 py-3 text-gray-400">{player.yearsExp ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{player.status || "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {players.length > 0 && (
          <div className="p-4 border-t border-gray-800 flex justify-between items-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded text-white"
            >
              Previous
            </button>
            <span className="text-gray-400">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={players.length < 50}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded text-white"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

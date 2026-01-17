"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { PositionBadge, RookieBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { Skeleton } from "@/components/ui/Skeleton";

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
  const [nflverseSeason, setNflverseSeason] = useState(new Date().getFullYear());
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
      const res = await fetch(`/api/nflverse/sync?season=${nflverseSeason}&type=stats`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const playersUpdated = data.result?.stats?.playersUpdated || 0;
        success(`Synced ${playersUpdated} player stats for ${nflverseSeason}`);
      } else {
        error(data.error || "NFLverse sync failed");
      }
    } catch {
      error("NFLverse sync failed");
    } finally {
      setSyncingNflverse(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Player Management</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={syncPlayers}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg text-white font-medium"
          >
            {syncing ? "Syncing..." : "Sync from Sleeper"}
          </button>
          <div className="flex items-center gap-2">
            <select
              value={nflverseSeason}
              onChange={(e) => setNflverseSeason(Number(e.target.value))}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
            >
              {[2025, 2024, 2023, 2022].map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <button
              onClick={syncNflverseStats}
              disabled={syncingNflverse}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-not-allowed rounded-lg text-white font-medium"
            >
              {syncingNflverse ? "Syncing..." : "Sync NFLverse Stats"}
            </button>
          </div>
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

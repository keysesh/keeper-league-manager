"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trash2, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface League {
  id: string;
  name: string;
  sleeperId: string;
  season: number;
  status: string;
  totalRosters: number;
  updatedAt: string;
  lastSyncedAt: string | null;
  _count: { rosters: number };
  keeperCount: number;
}

interface SyncResult {
  leagueId: string;
  status: "idle" | "syncing" | "success" | "error";
  message?: string;
}

export default function AdminLeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncResult>>({});

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/leagues");
      if (res.ok) {
        const data = await res.json();
        setLeagues(data.leagues || []);
      }
    } catch (error) {
      console.error("Failed to fetch leagues:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeagues();
  }, []);

  const handleDelete = async (leagueId: string, leagueName: string) => {
    if (confirmDelete !== leagueId) {
      setConfirmDelete(leagueId);
      return;
    }

    setDeleting(leagueId);
    try {
      const res = await fetch(`/api/admin/delete-league?name=${encodeURIComponent(leagueName)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setLeagues(leagues.filter(l => l.id !== leagueId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete league");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete league");
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  // Refresh - Quick roster update
  const handleRefresh = async (leagueId: string) => {
    setSyncStatus(prev => ({ ...prev, [leagueId]: { leagueId, status: "syncing", message: "Refreshing..." } }));
    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", leagueId }),
      });

      if (!res.ok) throw new Error("Refresh failed");

      const data = await res.json();
      setSyncStatus(prev => ({
        ...prev,
        [leagueId]: {
          leagueId,
          status: "success",
          message: `Refreshed ${data.data?.rosters || 0} rosters`
        }
      }));
      fetchLeagues();
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, [leagueId]: { leagueId, status: "error", message: String(error) } }));
    }
  };

  // Sync - Standard full sync (league + drafts + trades)
  const handleSync = async (leagueId: string) => {
    setSyncStatus(prev => ({ ...prev, [leagueId]: { leagueId, status: "syncing", message: "Syncing data..." } }));
    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", leagueId }),
      });

      if (!res.ok) throw new Error("Sync failed");

      const data = await res.json();
      const rosters = data.data?.rosters || 0;
      const tradedPicks = data.data?.tradedPicks || 0;
      setSyncStatus(prev => ({
        ...prev,
        [leagueId]: {
          leagueId,
          status: "success",
          message: `Synced ${rosters} rosters, ${tradedPicks} traded picks`
        }
      }));
      fetchLeagues();
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, [leagueId]: { leagueId, status: "error", message: String(error) } }));
    }
  };

  // Sync History - All historical seasons
  const handleSyncHistory = async (leagueId: string) => {
    setSyncStatus(prev => ({ ...prev, [leagueId]: { leagueId, status: "syncing", message: "Syncing all seasons..." } }));
    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-history", leagueId }),
      });

      if (!res.ok) throw new Error("History sync failed");

      const data = await res.json();
      const seasons = data.data?.seasons?.length || 0;
      const totalTransactions = data.data?.totalTransactions || 0;
      setSyncStatus(prev => ({
        ...prev,
        [leagueId]: {
          leagueId,
          status: "success",
          message: `Synced ${seasons} seasons, ${totalTransactions} transactions`
        }
      }));
      fetchLeagues();
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, [leagueId]: { leagueId, status: "error", message: String(error) } }));
    }
  };

  // Sync Drafts - All historical drafts (slow but needed for keeper costs)
  const handleSyncDrafts = async (leagueId: string) => {
    setSyncStatus(prev => ({ ...prev, [leagueId]: { leagueId, status: "syncing", message: "Syncing drafts..." } }));
    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-drafts", leagueId }),
      });

      if (!res.ok) throw new Error("Draft sync failed");

      const data = await res.json();
      const picks = data.data?.picks || 0;
      const seasons = data.data?.seasons || 0;
      setSyncStatus(prev => ({
        ...prev,
        [leagueId]: {
          leagueId,
          status: "success",
          message: `Synced ${picks} draft picks from ${seasons} seasons`
        }
      }));
      fetchLeagues();
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, [leagueId]: { leagueId, status: "error", message: String(error) } }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">League Management</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">{leagues.length} leagues</span>
          <button
            onClick={fetchLeagues}
            className="p-2 rounded-md bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-left">
              <th className="px-4 py-3 text-gray-400 font-medium text-sm">League</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-sm">Season</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-sm">Teams</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-sm">Keepers</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-sm">Status</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-sm">Last Synced</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-sm">Sync</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((league) => (
              <tr key={league.id} className="border-b border-[#2a2a2a] hover:bg-[#222]">
                <td className="px-4 py-3">
                  <div>
                    <div className="text-white font-medium text-sm">{league.name}</div>
                    <div className="text-xs text-gray-500">{league.sleeperId}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">{league.season}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {league._count.rosters}/{league.totalRosters}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">{league.keeperCount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      league.status === "IN_SEASON"
                        ? "bg-green-500/20 text-green-400"
                        : league.status === "PRE_DRAFT"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-[#2a2a2a] text-gray-400"
                    }`}
                  >
                    {league.status?.replace("_", " ").toLowerCase() || "Unknown"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {league.lastSyncedAt
                    ? new Date(league.lastSyncedAt).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {syncStatus[league.id]?.status === "syncing" ? (
                      <div className="flex items-center gap-2 text-blue-400 text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-xs">{syncStatus[league.id]?.message || "Syncing..."}</span>
                      </div>
                    ) : syncStatus[league.id]?.status === "success" ? (
                      <div className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle className="w-4 h-4" />
                        <span>{syncStatus[league.id]?.message}</span>
                      </div>
                    ) : syncStatus[league.id]?.status === "error" ? (
                      <div className="flex items-center gap-1 text-red-400 text-xs">
                        <XCircle className="w-4 h-4" />
                        <span>Failed</span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRefresh(league.id)}
                          className="px-2 py-1 rounded text-xs font-medium bg-[#2a2a2a] text-gray-300 hover:bg-[#333] hover:text-white transition-colors"
                          title="Refresh rosters only (fast)"
                        >
                          Refresh
                        </button>
                        <button
                          onClick={() => handleSync(league.id)}
                          className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                          title="Sync league + drafts + trades"
                        >
                          Sync
                        </button>
                        <button
                          onClick={() => handleSyncHistory(league.id)}
                          className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                          title="Sync rosters + traded picks for all seasons (fast)"
                        >
                          History
                        </button>
                        <button
                          onClick={() => handleSyncDrafts(league.id)}
                          className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                          title="Sync all draft picks for all seasons (slow, needed for keeper costs)"
                        >
                          Drafts
                        </button>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/league/${league.id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View
                    </Link>
                    {confirmDelete === league.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(league.id, league.name)}
                          disabled={deleting === league.id}
                          className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                        >
                          {deleting === league.id ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 rounded text-xs font-medium bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDelete(league.id, league.name)}
                        className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete league"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {leagues.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No leagues found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Warning */}
      <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-500/90">
          <strong>Warning:</strong> Deleting a league will permanently remove all associated data including rosters, keepers, drafts, and transactions. This action cannot be undone.
        </div>
      </div>
    </div>
  );
}

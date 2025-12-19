"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Roster {
  id: string;
  sleeperId: string;
  teamName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  isUserRoster: boolean;
  owners: Array<{
    id: string;
    displayName: string;
    avatar: string | null;
    role: string;
  }>;
  playerCount: number;
  keeperCount: number;
  currentKeepers: Array<{
    id: string;
    player: {
      fullName: string;
      position: string;
      team: string;
    };
    type: string;
    finalCost: number;
  }>;
}

interface League {
  id: string;
  sleeperId: string;
  name: string;
  season: number;
  status: string;
  totalRosters: number;
  draftRounds: number;
  lastSyncedAt: string | null;
  keeperSettings: {
    maxKeepers: number;
    maxFranchiseTags: number;
    maxRegularKeepers: number;
    regularKeeperMaxYears: number;
    undraftedRound: number;
  } | null;
  rosters: Roster[];
  recentDrafts: Array<{
    id: string;
    season: number;
    type: string;
    status: string;
  }>;
  counts: {
    rosters: number;
    drafts: number;
    transactions: number;
  };
}

export default function LeaguePage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.leagueId as string;
  const { success, error: showError } = useToast();

  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchLeague();
  }, [leagueId]);

  const fetchLeague = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch league");
      }
      const data = await res.json();
      setLeague(data);
    } catch {
      setError("Failed to load league");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quick",
          leagueId,
        }),
      });

      if (!res.ok) {
        throw new Error("Sync failed");
      }

      await fetchLeague();
      success("League synced successfully");
    } catch {
      showError("Failed to sync league");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-4 w-32" />
            ))}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error || "League not found"}</p>
        </div>
      </div>
    );
  }

  const userRoster = league.rosters.find((r) => r.isUserRoster);

  return (
    <div className="p-4 space-y-4">
      {/* Header - Compact */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{league.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 font-semibold rounded">
              {league.season}
            </span>
            <span className="text-gray-500">{league.totalRosters} teams</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-xs font-medium text-white border border-gray-700"
          >
            {syncing ? "..." : "Sync"}
          </button>
          <Link
            href={`/league/${leagueId}/draft-board`}
            className="btn-premium px-3 py-1.5 rounded-lg text-xs text-white"
          >
            Draft Board
          </Link>
        </div>
      </div>

      {/* Quick Stats - Compact Square Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="stat-card">
          <p className="text-xl font-bold text-white">
            {userRoster ? `${userRoster.wins}-${userRoster.losses}` : "—"}
          </p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase">Record</p>
        </div>
        <div className="stat-card">
          <p className="text-xl font-bold text-green-400">
            {userRoster?.pointsFor.toFixed(0) || "0"}
          </p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase">PF</p>
        </div>
        <div className="stat-card">
          <p className="text-xl font-bold text-purple-400">
            {userRoster?.keeperCount || 0}/{league.keeperSettings?.maxKeepers || 7}
          </p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase">Keepers</p>
        </div>
        <div className="stat-card">
          <p className="text-xl font-bold text-gray-400">
            {league.lastSyncedAt ? new Date(league.lastSyncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
          </p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase">Synced</p>
        </div>
      </div>

      {/* Keeper Rules - Compact Inline */}
      {league.keeperSettings && (
        <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-gray-800/40 text-xs">
          <span className="text-gray-500">Rules:</span>
          <span className="text-white"><b>{league.keeperSettings.maxKeepers}</b> max</span>
          <span className="text-amber-400"><b>{league.keeperSettings.maxFranchiseTags}</b> FT</span>
          <span className="text-purple-400"><b>{league.keeperSettings.maxRegularKeepers}</b> reg</span>
          <span className="text-gray-400"><b>{league.keeperSettings.regularKeeperMaxYears}</b>yr limit</span>
          <span className="text-gray-500">Undrafted: Rd{league.keeperSettings.undraftedRound}</span>
        </div>
      )}

      {/* Your Keepers - Compact */}
      {userRoster && (
        <div className="card-compact rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">Your Keepers</span>
            <Link
              href={`/league/${leagueId}/team/${userRoster.id}`}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Manage &rarr;
            </Link>
          </div>
          {userRoster.currentKeepers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {userRoster.currentKeepers.map((keeper) => (
                <div
                  key={keeper.id}
                  className={`player-card flex items-center gap-2 border-l-2 ${
                    keeper.player.position === "QB" ? "border-l-red-500" :
                    keeper.player.position === "RB" ? "border-l-green-500" :
                    keeper.player.position === "WR" ? "border-l-blue-500" :
                    keeper.player.position === "TE" ? "border-l-orange-500" : "border-l-gray-500"
                  }`}
                >
                  <span className={`text-[10px] font-bold px-1 rounded ${keeper.type === "FRANCHISE" ? "bg-amber-500 text-black" : "bg-purple-600 text-white"}`}>
                    {keeper.type === "FRANCHISE" ? "FT" : "K"}
                  </span>
                  <PositionBadge position={keeper.player.position} size="xs" />
                  <span className="text-xs text-white font-medium truncate max-w-[100px]">{keeper.player.fullName}</span>
                  <span className="text-xs text-gray-400">R{keeper.finalCost}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No keepers yet</p>
          )}
        </div>
      )}

      {/* Standings - Compact Table */}
      <div className="card-compact rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-800/50">
          <span className="text-xs font-semibold text-gray-400 uppercase">Standings</span>
        </div>
        <div className="divide-y divide-gray-800/30">
          {league.rosters.map((roster, index) => (
            <Link
              key={roster.id}
              href={`/league/${leagueId}/team/${roster.id}`}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-800/30 ${
                roster.isUserRoster ? "bg-purple-500/5" : ""
              }`}
            >
              <span className={`w-5 text-xs font-bold ${index < 3 ? "text-amber-400" : "text-gray-600"}`}>
                {index + 1}
              </span>
              <span className="flex-1 text-sm text-white font-medium truncate">
                {roster.teamName || "Team " + roster.sleeperId}
                {roster.isUserRoster && <span className="ml-1 text-purple-400 text-[10px]">•</span>}
              </span>
              <span className="text-xs text-gray-400 w-12 text-center">{roster.wins}-{roster.losses}</span>
              <span className="text-xs text-gray-500 w-12 text-right">{roster.pointsFor.toFixed(0)}</span>
              <span className={`text-[10px] font-bold w-8 text-center ${
                roster.keeperCount >= (league.keeperSettings?.maxKeepers || 7) ? "text-green-400" : "text-gray-500"
              }`}>
                {roster.keeperCount}/{league.keeperSettings?.maxKeepers || 7}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Links - Compact Row */}
      <div className="flex gap-2">
        <Link
          href={`/league/${leagueId}/draft-board`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <span>📋</span> Draft Board
        </Link>
        <Link
          href={`/league/${leagueId}/trade-analyzer`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <span>🔄</span> Trade
        </Link>
        <Link
          href={`/league/${leagueId}/history`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <span>📈</span> History
        </Link>
        <Link
          href={`/league/${leagueId}/settings`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <span>⚙️</span> Settings
        </Link>
      </div>
    </div>
  );
}

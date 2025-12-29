"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { LayoutGrid, ArrowLeftRight, TrendingUp, Settings, Activity, MessageCircle } from "lucide-react";
import { DeadlineBanner } from "@/components/ui/DeadlineBanner";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

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
  const leagueId = params.leagueId as string;
  const { success, error: showError } = useToast();
  const [syncing, setSyncing] = useState(false);

  // Use SWR for faster data loading with caching
  const { data: league, error, mutate, isLoading } = useSWR<League>(
    `/api/leagues/${leagueId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quick", leagueId }),
      });

      if (!res.ok) throw new Error("Sync failed");

      mutate(); // Revalidate data
      success("Synced");
    } catch {
      showError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
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
    <>
      <DeadlineBanner leagueId={leagueId} />
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
              {userRoster.currentKeepers.map((keeper) => {
                const posColors = {
                  QB: { bg: "bg-red-500/10", border: "border-l-red-500", text: "text-red-400" },
                  RB: { bg: "bg-green-500/10", border: "border-l-green-500", text: "text-green-400" },
                  WR: { bg: "bg-blue-500/10", border: "border-l-blue-500", text: "text-blue-400" },
                  TE: { bg: "bg-orange-500/10", border: "border-l-orange-500", text: "text-orange-400" },
                  K: { bg: "bg-purple-500/10", border: "border-l-purple-500", text: "text-purple-400" },
                  DEF: { bg: "bg-gray-500/10", border: "border-l-gray-500", text: "text-gray-400" },
                };
                const colors = posColors[keeper.player.position as keyof typeof posColors] || posColors.DEF;

                return (
                  <div
                    key={keeper.id}
                    className={`player-card flex items-center gap-2 border-l-2 ${colors.border} ${colors.bg}`}
                  >
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      keeper.type === "FRANCHISE"
                        ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black"
                        : "bg-gradient-to-r from-purple-500 to-purple-700 text-white"
                    }`}>
                      {keeper.type === "FRANCHISE" ? "FT" : "K"}
                    </span>
                    <PositionBadge position={keeper.player.position} size="xs" />
                    <span className="text-xs text-white font-medium truncate max-w-[100px]">{keeper.player.fullName}</span>
                    <span className={`text-xs font-semibold ${colors.text}`}>R{keeper.finalCost}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No keepers yet</p>
          )}
        </div>
      )}

      {/* Standings - Premium Table */}
      <div className="card-compact rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50">
          <span className="text-xs font-semibold text-gray-400 uppercase">Standings</span>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span>W-L</span>
            <span>PF</span>
            <span>K</span>
          </div>
        </div>
        <div className="divide-y divide-gray-800/20">
          {league.rosters.map((roster, index) => {
            const isPlayoff = index < 6;
            const isTop3 = index < 3;

            return (
              <Link
                key={roster.id}
                href={`/league/${leagueId}/team/${roster.id}`}
                className={`flex items-center gap-2 px-3 py-2.5 transition-all hover:bg-gray-800/40 ${
                  roster.isUserRoster
                    ? "bg-gradient-to-r from-purple-500/10 to-transparent border-l-2 border-purple-500"
                    : isTop3
                    ? "bg-gradient-to-r from-amber-500/5 to-transparent"
                    : ""
                }`}
              >
                <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded ${
                  index === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black" :
                  index === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-black" :
                  index === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600 text-black" :
                  isPlayoff ? "bg-green-500/20 text-green-400" :
                  "bg-gray-800 text-gray-500"
                }`}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium truncate block ${
                    roster.isUserRoster ? "text-purple-300" : "text-white"
                  }`}>
                    {roster.teamName || "Team " + roster.sleeperId}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold w-10 text-center ${
                    roster.wins > roster.losses ? "text-green-400" :
                    roster.wins < roster.losses ? "text-red-400" : "text-gray-400"
                  }`}>
                    {roster.wins}-{roster.losses}
                  </span>
                  <span className="text-xs text-gray-500 w-10 text-right font-mono">
                    {roster.pointsFor.toFixed(0)}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    roster.keeperCount >= (league.keeperSettings?.maxKeepers || 7)
                      ? "bg-green-500/20 text-green-400"
                      : roster.keeperCount > 0
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-gray-800 text-gray-500"
                  }`}>
                    {roster.keeperCount}/{league.keeperSettings?.maxKeepers || 7}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Links - Compact Row */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href={`/league/${leagueId}/draft-board`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <LayoutGrid size={14} /> Draft Board
        </Link>
        <Link
          href={`/league/${leagueId}/trade-analyzer`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <ArrowLeftRight size={14} /> Trade
        </Link>
        <Link
          href={`/league/${leagueId}/trade-proposals`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <MessageCircle size={14} /> Proposals
        </Link>
        <Link
          href={`/league/${leagueId}/activity`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <Activity size={14} /> Activity
        </Link>
        <Link
          href={`/league/${leagueId}/history`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <TrendingUp size={14} /> History
        </Link>
        <Link
          href={`/league/${leagueId}/settings`}
          className="card-compact rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-purple-400 hover:border-purple-500/30"
        >
          <Settings size={14} /> Settings
        </Link>
      </div>
      </div>
    </>
  );
}

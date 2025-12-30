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
import { RecordCard, PointsCard, KeepersCard, SyncedCard } from "@/components/ui/StatCard";
import { StandingsTable } from "@/components/ui/StandingsTable";

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

      {/* Quick Stats - Premium Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <RecordCard
          wins={userRoster?.wins || 0}
          losses={userRoster?.losses || 0}
          ties={userRoster?.ties || 0}
        />
        <PointsCard
          points={Math.round(userRoster?.pointsFor || 0)}
          rank={userRoster ? league.rosters
            .sort((a, b) => b.pointsFor - a.pointsFor)
            .findIndex(r => r.id === userRoster.id) + 1 : undefined}
        />
        <KeepersCard
          current={userRoster?.keeperCount || 0}
          max={league.keeperSettings?.maxKeepers || 7}
          franchiseTags={userRoster?.currentKeepers.filter(k => k.type === "FRANCHISE").length || 0}
        />
        <SyncedCard
          date={league.lastSyncedAt}
          isStale={league.lastSyncedAt ? (Date.now() - new Date(league.lastSyncedAt).getTime()) > 86400000 : true}
        />
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
      <StandingsTable
        rosters={league.rosters}
        leagueId={leagueId}
        maxKeepers={league.keeperSettings?.maxKeepers || 7}
        playoffSpots={6}
      />

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

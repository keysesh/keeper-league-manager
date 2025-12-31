"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { DeadlineBanner } from "@/components/ui/DeadlineBanner";
import { RecordCard, PointsCard, KeepersCard, SyncedCard } from "@/components/ui/StatCard";
import { StandingsTable } from "@/components/ui/StandingsTable";
import { KeepersSection } from "@/components/ui/KeeperCard";
import { RulesBar } from "@/components/ui/RulesBar";
import { QuickLinks } from "@/components/ui/QuickLinks";
import { PageHeader } from "@/components/ui/PageHeader";

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
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
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
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">{error || "League not found"}</p>
        </div>
      </div>
    );
  }

  const userRoster = league.rosters.find((r) => r.isUserRoster);

  return (
    <>
      <DeadlineBanner leagueId={leagueId} />
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 md:space-y-5">
        {/* Header */}
        <PageHeader
          title={league.name}
          badge={{ label: String(league.season), color: "purple" }}
          teamCount={league.totalRosters}
          syncing={syncing}
          onSync={handleSync}
          primaryAction={{
            label: "Draft Board",
            href: `/league/${leagueId}/draft-board`,
          }}
        />

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

      {/* Keeper Rules */}
      {league.keeperSettings && (
        <RulesBar settings={league.keeperSettings} />
      )}

      {/* Your Keepers */}
      {userRoster && (
        <KeepersSection
          keepers={userRoster.currentKeepers.map(k => ({
            ...k,
            type: k.type as "REGULAR" | "FRANCHISE",
          }))}
          leagueId={leagueId}
          rosterId={userRoster.id}
          maxKeepers={league.keeperSettings?.maxKeepers || 7}
        />
      )}

      {/* Standings - Premium Table */}
      <StandingsTable
        rosters={league.rosters}
        leagueId={leagueId}
        maxKeepers={league.keeperSettings?.maxKeepers || 7}
        playoffSpots={6}
      />

      {/* Quick Links */}
      <QuickLinks
        leagueId={leagueId}
        userRosterId={league.rosters.find(r => r.isUserRoster)?.id}
      />
      </div>
    </>
  );
}

"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { DeadlineBanner } from "@/components/ui/DeadlineBanner";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { TrendingPlayers } from "@/components/ui/TrendingPlayers";
import { ChevronRight, Trophy, Shield, Crown, Target, Zap, BarChart3, Users, RefreshCw, Star } from "lucide-react";

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

      mutate();
      success("Synced");
    } catch {
      showError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Skeleton className="h-40 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-6">
          <p className="text-red-500 font-medium">{error || "League not found"}</p>
        </div>
      </div>
    );
  }

  const userRoster = league.rosters.find((r) => r.isUserRoster);
  const sortedRosters = [...league.rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });
  const userRank = userRoster ? sortedRosters.findIndex(r => r.id === userRoster.id) + 1 : 0;
  const maxKeepers = league.keeperSettings?.maxKeepers || 7;
  const franchiseCount = userRoster?.currentKeepers.filter(k => k.type === "FRANCHISE").length || 0;

  return (
    <>
      <DeadlineBanner leagueId={leagueId} />
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">

        {/* HERO SECTION */}
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md">
          <div className="p-4 sm:p-6 md:p-8">
            {/* Header Row */}
            <div className="flex flex-col gap-4 sm:gap-5 md:flex-row md:items-start md:justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-14 sm:h-14 flex-shrink-0 rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center">
                  <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
                    {league.name}
                  </h1>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
                    {league.totalRosters} teams &middot; {league.season} Season
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center justify-center gap-2 min-w-[40px] h-10 sm:min-w-0 sm:h-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-md bg-[#222222] hover:bg-[#2a2a2a] active:bg-[#333333] border border-[#2a2a2a] hover:border-[#333333] text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync"}</span>
                </button>
                <Link
                  href={`/league/${leagueId}/draft-board`}
                  className="flex items-center justify-center gap-2 h-10 sm:h-auto px-4 sm:px-5 py-2 sm:py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-sm font-semibold text-white transition-colors"
                >
                  <Target className="w-4 h-4" />
                  <span className="hidden xs:inline">Draft Board</span>
                  <span className="xs:hidden">Draft</span>
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            {userRoster && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                {/* Standing Card */}
                <div className="rounded-md bg-[#222222] border border-[#2a2a2a] p-3 sm:p-4 md:p-5 hover:border-[#333333] transition-colors">
                  <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Standing</span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tabular-nums">#{userRank}</span>
                      <span className="text-sm sm:text-base md:text-lg text-gray-500 ml-1">/ {league.totalRosters}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm border-t border-[#2a2a2a] pt-2 sm:pt-3">
                      <span className="text-gray-500">Record</span>
                      <span className={`font-semibold tabular-nums ${userRoster.wins > userRoster.losses ? "text-green-500" : userRoster.wins < userRoster.losses ? "text-red-500" : "text-gray-300"}`}>
                        {userRoster.wins}-{userRoster.losses}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center justify-between text-sm">
                      <span className="text-gray-500">Points</span>
                      <span className="font-semibold text-gray-300 tabular-nums">{Math.round(userRoster.pointsFor).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Keepers Card */}
                <div className="rounded-md bg-[#222222] border border-[#2a2a2a] p-3 sm:p-4 md:p-5 hover:border-[#333333] transition-colors">
                  <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                      <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Keepers</span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tabular-nums">{userRoster.keeperCount}</span>
                      <span className="text-sm sm:text-base md:text-lg text-gray-500 ml-1">/ {maxKeepers}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm border-t border-[#2a2a2a] pt-2 sm:pt-3">
                      <span className="text-gray-500">Franchise</span>
                      <span className="font-semibold text-yellow-500 tabular-nums">{franchiseCount}</span>
                    </div>
                    <div className="hidden sm:flex items-center justify-between text-sm">
                      <span className="text-gray-500">Regular</span>
                      <span className="font-semibold text-gray-300 tabular-nums">{userRoster.keeperCount - franchiseCount}</span>
                    </div>
                  </div>
                </div>

                {/* CTA Card */}
                <Link
                  href={`/league/${leagueId}/team/${userRoster.id}`}
                  className="col-span-2 md:col-span-1 rounded-md bg-blue-600/10 border border-blue-500/30 p-3 sm:p-4 md:p-5 hover:border-blue-500/50 hover:bg-blue-600/15 transition-colors"
                >
                  <div className="flex items-center md:items-start justify-between md:mb-6">
                    <div className="flex items-center gap-3 md:block">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      </div>
                      <div className="md:hidden">
                        <p className="text-sm sm:text-base font-semibold text-white">Manage Keepers</p>
                        <p className="text-xs text-gray-400">Select your {league.season} keepers</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="hidden md:block">
                    <p className="text-lg font-semibold text-white mb-1">Manage Keepers</p>
                    <p className="text-sm text-gray-400">Select and lock your {league.season} keepers</p>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* YOUR KEEPERS */}
        {userRoster && userRoster.currentKeepers.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                  <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-white">Your {league.season} Keepers</h2>
              </div>
              <Link
                href={`/league/${leagueId}/team/${userRoster.id}`}
                className="text-xs sm:text-sm text-blue-500 hover:text-blue-400 font-medium flex items-center gap-0.5 sm:gap-1 transition-colors py-1 px-2 -mr-2 rounded-md hover:bg-blue-500/10"
              >
                Manage <ChevronRight size={14} className="sm:hidden" /><ChevronRight size={16} className="hidden sm:block" />
              </Link>
            </div>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 sm:gap-3">
              {userRoster.currentKeepers.map((keeper) => (
                <div
                  key={keeper.id}
                  className={`relative rounded-md p-2.5 sm:p-3 md:p-4 transition-colors ${
                    keeper.type === "FRANCHISE"
                      ? "bg-[#1a1a1a] border-t-2 border-t-yellow-500 border border-[#2a2a2a] hover:border-[#333333]"
                      : "bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#333333]"
                  }`}
                >
                  {keeper.type === "FRANCHISE" && (
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                      <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 fill-yellow-500" />
                    </div>
                  )}

                  <PositionBadge position={keeper.player.position} size="xs" className="mb-1.5 sm:mb-2" />
                  <p className="text-xs sm:text-sm font-semibold text-white truncate">{keeper.player.fullName}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">{keeper.player.team}</p>

                  <div className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-bold ${
                    keeper.type === "FRANCHISE"
                      ? "bg-yellow-500/20 text-yellow-500"
                      : "bg-[#222222] text-gray-300"
                  }`}>
                    R{keeper.finalCost}
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: Math.min(maxKeepers - userRoster.currentKeepers.length, 3) }).map((_, i) => (
                <Link
                  key={`empty-${i}`}
                  href={`/league/${leagueId}/team/${userRoster.id}`}
                  className="rounded-md p-2.5 sm:p-3 md:p-4 border-2 border-dashed border-[#2a2a2a] hover:border-blue-500/50 flex flex-col items-center justify-center text-gray-600 hover:text-blue-500 transition-colors min-h-[100px] sm:min-h-[120px] md:min-h-[140px] hover:bg-blue-500/5"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md border-2 border-dashed border-current flex items-center justify-center mb-1.5 sm:mb-2">
                    <span className="text-lg sm:text-xl">+</span>
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium">Add Keeper</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* STANDINGS */}
        <section>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-white">League Standings</h2>
            </div>
            <Link
              href={`/league/${leagueId}/team`}
              className="text-xs sm:text-sm text-gray-400 hover:text-white font-medium flex items-center gap-0.5 sm:gap-1 transition-colors py-1 px-2 -mr-2 rounded-md hover:bg-[#1a1a1a]"
            >
              View All <ChevronRight size={14} className="sm:hidden" /><ChevronRight size={16} className="hidden sm:block" />
            </Link>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            {sortedRosters.slice(0, 8).map((roster, index) => {
              const rank = index + 1;
              const isUser = roster.isUserRoster;
              const isPlayoff = rank <= 6;

              return (
                <Link
                  key={roster.id}
                  href={`/league/${leagueId}/team/${roster.id}`}
                  className={`group flex items-center gap-2 sm:gap-3 md:gap-4 p-2.5 sm:p-3 md:p-4 rounded-md transition-colors ${
                    isUser
                      ? "bg-blue-600/10 border-l-2 border-l-blue-500 border border-[#2a2a2a] hover:border-[#333333]"
                      : "bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#333333]"
                  }`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center font-bold text-sm sm:text-base ${
                      rank === 1 ? "bg-yellow-500 text-black" :
                      rank === 2 ? "bg-gray-400 text-black" :
                      rank === 3 ? "bg-orange-600 text-white" :
                      isPlayoff ? "bg-green-500/20 text-green-500 border border-green-500/30" :
                      "bg-[#222222] text-gray-500"
                    }`}>
                      {rank === 1 ? <Crown className="w-4 h-4 sm:w-5 sm:h-5" /> : rank}
                    </div>
                  </div>

                  {/* Team Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-sm sm:text-base font-semibold truncate text-white">
                        {roster.teamName || `Team ${roster.sleeperId}`}
                      </span>
                      {isUser && (
                        <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded bg-blue-500/20 text-blue-500 uppercase tracking-wide flex-shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    {roster.owners?.[0] && (
                      <span className="text-[10px] sm:text-xs text-gray-500 hidden xs:block">{roster.owners[0].displayName}</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 sm:gap-4 md:gap-6 text-xs sm:text-sm">
                    <div className="text-right w-10 sm:w-12">
                      <span className={`font-semibold tabular-nums ${
                        roster.wins > roster.losses ? "text-green-500" :
                        roster.wins < roster.losses ? "text-red-500" : "text-gray-300"
                      }`}>
                        {roster.wins}-{roster.losses}
                      </span>
                    </div>
                    <div className="text-right w-12 sm:w-16 hidden md:block">
                      <span className="text-gray-400 font-medium tabular-nums">{Math.round(roster.pointsFor).toLocaleString()}</span>
                    </div>
                    <div className="w-10 sm:w-14 text-center">
                      <span className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded ${
                        roster.keeperCount >= maxKeepers ? "bg-green-500/20 text-green-500" :
                        roster.keeperCount > 0 ? "bg-blue-500/20 text-blue-500" :
                        "bg-[#222222] text-gray-600"
                      }`}>
                        {roster.keeperCount}/{maxKeepers}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <QuickActionCard
            href={`/league/${leagueId}/draft-board`}
            icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />}
            label="Draft Board"
            description="View keeper costs"
          />
          <QuickActionCard
            href={`/league/${leagueId}/trade-analyzer`}
            icon={<Zap className="w-4 h-4 sm:w-5 sm:h-5" />}
            label="Trade Analyzer"
            description="Evaluate trades"
          />
          <QuickActionCard
            href={`/league/${leagueId}/team`}
            icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />}
            label="All Teams"
            description="League rosters"
          />
          <QuickActionCard
            href={`/league/${leagueId}/history`}
            icon={<BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />}
            label="History"
            description="Past seasons"
          />
        </section>

        {/* TRENDING PLAYERS */}
        <section>
          <TrendingPlayers type="both" limit={10} hours={24} />
        </section>

        {/* Footer */}
        {league.lastSyncedAt && (
          <p className="text-center text-[10px] sm:text-xs text-gray-600 pb-2 sm:pb-4">
            Last synced {new Date(league.lastSyncedAt).toLocaleDateString()} at{" "}
            {new Date(league.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </>
  );
}

function QuickActionCard({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group p-3 sm:p-4 md:p-5 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#333333] transition-colors"
    >
      <div className="mb-2 sm:mb-3 md:mb-4">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
          {icon}
        </div>
      </div>
      <p className="font-semibold text-white text-xs sm:text-sm mb-0.5">{label}</p>
      <p className="text-[10px] sm:text-xs text-gray-500 hidden xs:block">{description}</p>
    </Link>
  );
}

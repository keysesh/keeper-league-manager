"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { DeadlineBanner } from "@/components/ui/DeadlineBanner";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { ChevronRight, ArrowUpRight } from "lucide-react";
import {
  IconGradientDefs,
  TrophyIcon,
  ShieldIcon,
  CrownIcon,
  TargetIcon,
  LightningIcon,
  ChartIcon,
  UsersIcon,
  SyncIcon,
  StarIcon,
  RankBadge,
  IconContainer,
} from "@/components/ui/PremiumIcons";

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
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">{error || "League not found"}</p>
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
      <IconGradientDefs />
      <DeadlineBanner leagueId={leagueId} />
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 lg:space-y-10">

        {/* ============================================ */}
        {/* HERO SECTION */}
        {/* ============================================ */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
          {/* Layered background */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_-20%,rgba(139,92,246,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_100%,rgba(139,92,246,0.08),transparent_50%)]" />

          {/* Noise texture - hide on mobile for performance */}
          <div className="hidden sm:block absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }} />

          {/* Top edge highlight */}
          <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />

          <div className="relative p-4 sm:p-6 md:p-8 lg:p-10">
            {/* Header Row */}
            <div className="flex flex-col gap-4 sm:gap-5 md:flex-row md:items-start md:justify-between mb-6 sm:mb-8 lg:mb-10">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Trophy icon with glow */}
                <IconContainer variant="gold" className="w-11 h-11 sm:w-14 sm:h-14 flex-shrink-0">
                  <TrophyIcon size={24} className="sm:hidden" />
                  <TrophyIcon size={28} className="hidden sm:block" />
                </IconContainer>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight truncate">
                    {league.name}
                  </h1>
                  <p className="text-zinc-400 text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">
                    {league.totalRosters} teams &middot; {league.season} Season
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center justify-center gap-2 min-w-[40px] h-10 sm:min-w-0 sm:h-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-white/20 text-sm font-medium text-zinc-300 hover:text-white transition-all disabled:opacity-50 backdrop-blur-sm"
                >
                  <SyncIcon size={16} spinning={syncing} />
                  <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync"}</span>
                </button>
                <Link
                  href={`/league/${leagueId}/draft-board`}
                  className="group relative flex items-center justify-center gap-2 h-10 sm:h-auto px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl overflow-hidden text-sm font-semibold text-white transition-all"
                >
                  {/* Button gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-violet-600 to-indigo-600 bg-[length:200%_100%] group-hover:animate-shimmer" />
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10" />
                  <TargetIcon size={16} className="relative" />
                  <span className="relative hidden xs:inline">Draft Board</span>
                  <span className="relative xs:hidden">Draft</span>
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            {userRoster && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                {/* Standing Card */}
                <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/[0.08] p-3 sm:p-4 md:p-5 transition-all hover:border-white/[0.15]">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-400/0 via-emerald-400/30 to-emerald-400/0" />
                  <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-400/20 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
                        <ChartIcon size={18} className="sm:hidden" />
                        <ChartIcon size={20} className="hidden sm:block" />
                      </div>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Standing</span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tabular-nums">#{userRank}</span>
                      <span className="text-sm sm:text-base md:text-lg text-zinc-500 ml-1">/ {league.totalRosters}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm border-t border-white/[0.06] pt-2 sm:pt-3">
                      <span className="text-zinc-500">Record</span>
                      <span className={`font-semibold tabular-nums ${userRoster.wins > userRoster.losses ? "text-emerald-400" : userRoster.wins < userRoster.losses ? "text-red-400" : "text-zinc-300"}`}>
                        {userRoster.wins}-{userRoster.losses}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Points</span>
                      <span className="font-semibold text-zinc-300 tabular-nums">{Math.round(userRoster.pointsFor).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Keepers Card */}
                <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/[0.08] p-3 sm:p-4 md:p-5 transition-all hover:border-violet-500/30">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-400/0 via-violet-400/40 to-violet-400/0" />
                  <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-violet-400/20 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-400/20 to-violet-500/10 border border-violet-400/20 flex items-center justify-center">
                        <ShieldIcon size={18} className="sm:hidden" />
                        <ShieldIcon size={20} className="hidden sm:block" />
                      </div>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Keepers</span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tabular-nums">{userRoster.keeperCount}</span>
                      <span className="text-sm sm:text-base md:text-lg text-zinc-500 ml-1">/ {maxKeepers}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm border-t border-white/[0.06] pt-2 sm:pt-3">
                      <span className="text-zinc-500">Franchise</span>
                      <span className="font-semibold text-amber-400 tabular-nums">{franchiseCount}</span>
                    </div>
                    <div className="hidden sm:flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Regular</span>
                      <span className="font-semibold text-zinc-300 tabular-nums">{userRoster.keeperCount - franchiseCount}</span>
                    </div>
                  </div>
                </div>

                {/* CTA Card - Full width on mobile */}
                <Link
                  href={`/league/${leagueId}/team/${userRoster.id}`}
                  className="col-span-2 md:col-span-1 group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20 p-3 sm:p-4 md:p-5 transition-all hover:border-violet-400/40 hover:shadow-lg hover:shadow-violet-500/10 active:scale-[0.98]"
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-400/0 via-violet-400/50 to-violet-400/0" />
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-violet-400/10 rounded-full blur-2xl group-hover:bg-violet-400/20 transition-colors" />

                  <div className="relative flex items-center md:items-start justify-between md:mb-6">
                    <div className="flex items-center gap-3 md:block">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-400/30 to-violet-500/20 border border-violet-400/30 flex items-center justify-center">
                        <LightningIcon size={18} className="sm:hidden" />
                        <LightningIcon size={20} className="hidden sm:block" />
                      </div>
                      <div className="md:hidden">
                        <p className="text-sm sm:text-base font-semibold text-white">Manage Keepers</p>
                        <p className="text-xs text-zinc-400">Select your {league.season} keepers</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-violet-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <div className="hidden md:block">
                    <p className="text-lg font-semibold text-white mb-1">Manage Keepers</p>
                    <p className="text-sm text-zinc-400">Select and lock your {league.season} keepers</p>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ============================================ */}
        {/* YOUR KEEPERS */}
        {/* ============================================ */}
        {userRoster && userRoster.currentKeepers.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-violet-400/20 to-violet-500/10 border border-violet-400/20 flex items-center justify-center">
                  <CrownIcon size={14} className="sm:hidden" />
                  <CrownIcon size={16} className="hidden sm:block" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-white">Your {league.season} Keepers</h2>
              </div>
              <Link
                href={`/league/${leagueId}/team/${userRoster.id}`}
                className="text-xs sm:text-sm text-violet-400 hover:text-violet-300 active:text-violet-200 font-medium flex items-center gap-0.5 sm:gap-1 transition-colors py-1 px-2 -mr-2 rounded-lg hover:bg-violet-500/10"
              >
                Manage <ChevronRight size={14} className="sm:hidden" /><ChevronRight size={16} className="hidden sm:block" />
              </Link>
            </div>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 sm:gap-3">
              {userRoster.currentKeepers.map((keeper) => (
                <div
                  key={keeper.id}
                  className={`group relative rounded-xl sm:rounded-2xl p-2.5 sm:p-3 md:p-4 transition-all ${
                    keeper.type === "FRANCHISE"
                      ? "bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/10"
                      : "bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-white/[0.15]"
                  }`}
                >
                  {/* Top accent */}
                  <div className={`absolute top-0 left-2 right-2 h-px ${
                    keeper.type === "FRANCHISE"
                      ? "bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"
                      : "bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  }`} />

                  {keeper.type === "FRANCHISE" && (
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                      <StarIcon size={14} className="sm:hidden" />
                      <StarIcon size={16} className="hidden sm:block" />
                    </div>
                  )}

                  <PositionBadge position={keeper.player.position} size="xs" className="mb-1.5 sm:mb-2" />
                  <p className="text-xs sm:text-sm font-semibold text-white truncate">{keeper.player.fullName}</p>
                  <p className="text-[10px] sm:text-xs text-zinc-500 mb-1.5 sm:mb-2">{keeper.player.team}</p>

                  <div className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-xs sm:text-sm font-bold ${
                    keeper.type === "FRANCHISE"
                      ? "bg-amber-400/20 text-amber-400"
                      : "bg-white/[0.08] text-zinc-300"
                  }`}>
                    R{keeper.finalCost}
                  </div>
                </div>
              ))}

              {/* Empty slots - show fewer on mobile */}
              {Array.from({ length: Math.min(maxKeepers - userRoster.currentKeepers.length, 3) }).map((_, i) => (
                <Link
                  key={`empty-${i}`}
                  href={`/league/${leagueId}/team/${userRoster.id}`}
                  className="group rounded-xl sm:rounded-2xl p-2.5 sm:p-3 md:p-4 border-2 border-dashed border-zinc-800 hover:border-violet-500/30 active:border-violet-500/40 flex flex-col items-center justify-center text-zinc-600 hover:text-violet-400 transition-all min-h-[100px] sm:min-h-[120px] md:min-h-[140px] hover:bg-violet-500/5 active:bg-violet-500/10"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border-2 border-dashed border-current flex items-center justify-center mb-1.5 sm:mb-2 group-hover:border-solid">
                    <span className="text-lg sm:text-xl">+</span>
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium">Add Keeper</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ============================================ */}
        {/* STANDINGS */}
        {/* ============================================ */}
        <section>
          <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                <UsersIcon size={14} className="sm:hidden" />
                <UsersIcon size={16} className="hidden sm:block" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-white">League Standings</h2>
            </div>
            <Link
              href={`/league/${leagueId}/team`}
              className="text-xs sm:text-sm text-zinc-400 hover:text-white active:text-zinc-200 font-medium flex items-center gap-0.5 sm:gap-1 transition-colors py-1 px-2 -mr-2 rounded-lg hover:bg-white/[0.05]"
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
                  className={`group relative flex items-center gap-2 sm:gap-3 md:gap-4 p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl transition-all overflow-hidden active:scale-[0.99] ${
                    isUser
                      ? "bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20 hover:border-violet-400/40"
                      : "bg-white/[0.03] hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08]"
                  }`}
                >
                  {/* User indicator line */}
                  {isUser && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 sm:top-2 sm:bottom-2 w-0.5 sm:w-1 rounded-r-full bg-gradient-to-b from-violet-400 to-violet-600" />
                  )}

                  {/* Rank */}
                  <div className="relative flex-shrink-0">
                    {rank <= 3 && (
                      <div className={`absolute inset-0 rounded-lg sm:rounded-xl blur-lg hidden sm:block ${
                        rank === 1 ? "bg-amber-400/30" : rank === 2 ? "bg-zinc-400/20" : "bg-orange-400/20"
                      }`} />
                    )}
                    <div className={`relative w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-sm sm:text-base ${
                      rank === 1 ? "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-amber-900 shadow-lg shadow-amber-500/30" :
                      rank === 2 ? "bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500 text-zinc-800" :
                      rank === 3 ? "bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 text-orange-900" :
                      isPlayoff ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                      "bg-zinc-800/80 text-zinc-500"
                    }`}>
                      {rank === 1 ? <CrownIcon size={16} className="sm:hidden" /> : null}
                      {rank === 1 ? <CrownIcon size={20} className="hidden sm:block" /> : rank}
                    </div>
                  </div>

                  {/* Team Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className={`text-sm sm:text-base font-semibold truncate ${isUser ? "text-violet-100" : "text-white"}`}>
                        {roster.teamName || `Team ${roster.sleeperId}`}
                      </span>
                      {isUser && (
                        <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-violet-400/20 text-violet-400 uppercase tracking-wide flex-shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    {roster.owners?.[0] && (
                      <span className="text-[10px] sm:text-xs text-zinc-500 hidden xs:block">{roster.owners[0].displayName}</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 sm:gap-4 md:gap-6 text-xs sm:text-sm">
                    <div className="text-right w-10 sm:w-12">
                      <span className={`font-semibold tabular-nums ${
                        roster.wins > roster.losses ? "text-emerald-400" :
                        roster.wins < roster.losses ? "text-red-400" : "text-zinc-300"
                      }`}>
                        {roster.wins}-{roster.losses}
                      </span>
                    </div>
                    <div className="text-right w-12 sm:w-16 hidden md:block">
                      <span className="text-zinc-400 font-medium tabular-nums">{Math.round(roster.pointsFor).toLocaleString()}</span>
                    </div>
                    <div className="w-10 sm:w-14 text-center">
                      <span className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg ${
                        roster.keeperCount >= maxKeepers ? "bg-emerald-500/15 text-emerald-400" :
                        roster.keeperCount > 0 ? "bg-violet-500/15 text-violet-400" :
                        "bg-zinc-800/50 text-zinc-600"
                      }`}>
                        {roster.keeperCount}/{maxKeepers}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ============================================ */}
        {/* QUICK ACTIONS */}
        {/* ============================================ */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <QuickActionCard
            href={`/league/${leagueId}/draft-board`}
            icon={<TargetIcon size={18} />}
            label="Draft Board"
            description="View keeper costs"
            accentColor="violet"
          />
          <QuickActionCard
            href={`/league/${leagueId}/trade-analyzer`}
            icon={<LightningIcon size={18} />}
            label="Trade Analyzer"
            description="Evaluate trades"
            accentColor="emerald"
          />
          <QuickActionCard
            href={`/league/${leagueId}/team`}
            icon={<UsersIcon size={18} />}
            label="All Teams"
            description="League rosters"
            accentColor="blue"
          />
          <QuickActionCard
            href={`/league/${leagueId}/history`}
            icon={<ChartIcon size={18} />}
            label="History"
            description="Past seasons"
            accentColor="purple"
          />
        </section>

        {/* Footer */}
        {league.lastSyncedAt && (
          <p className="text-center text-[10px] sm:text-xs text-zinc-600 pb-2 sm:pb-4">
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
  accentColor,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  accentColor: "violet" | "emerald" | "blue" | "purple";
}) {
  const colors = {
    violet: {
      icon: "from-violet-400/20 to-violet-500/10 border-violet-400/20 text-violet-400",
      hover: "group-hover:border-violet-400/40 group-hover:shadow-violet-500/10",
      glow: "group-hover:bg-violet-400/20",
    },
    emerald: {
      icon: "from-emerald-400/20 to-emerald-500/10 border-emerald-400/20 text-emerald-400",
      hover: "group-hover:border-emerald-400/40 group-hover:shadow-emerald-500/10",
      glow: "group-hover:bg-emerald-400/20",
    },
    blue: {
      icon: "from-blue-400/20 to-blue-500/10 border-blue-400/20 text-blue-400",
      hover: "group-hover:border-blue-400/40 group-hover:shadow-blue-500/10",
      glow: "group-hover:bg-blue-400/20",
    },
    purple: {
      icon: "from-purple-400/20 to-purple-500/10 border-purple-400/20 text-purple-400",
      hover: "group-hover:border-purple-400/40 group-hover:shadow-purple-500/10",
      glow: "group-hover:bg-purple-400/20",
    },
  };

  const c = colors[accentColor];

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] transition-all hover:shadow-lg active:scale-[0.98] ${c.hover}`}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-3 right-3 sm:left-4 sm:right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative mb-2 sm:mb-3 md:mb-4">
        <div className={`absolute inset-0 rounded-lg sm:rounded-xl blur-lg opacity-0 transition-opacity hidden sm:block ${c.glow}`} />
        <div className={`relative w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br border flex items-center justify-center ${c.icon}`}>
          {icon}
        </div>
      </div>
      <p className="font-semibold text-white text-xs sm:text-sm mb-0.5">{label}</p>
      <p className="text-[10px] sm:text-xs text-zinc-500 hidden xs:block">{description}</p>
    </Link>
  );
}

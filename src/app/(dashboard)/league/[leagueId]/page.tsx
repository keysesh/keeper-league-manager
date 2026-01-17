"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { DeadlineBanner } from "@/components/ui/DeadlineBanner";
import { PositionBadge } from "@/components/ui/PositionBadge";
import {
  RefreshCw,
  Crown,
  ChevronRight,
  Trophy,
  Target,
  Zap,
  Users,
  Calendar,
  TrendingUp,
  Shield,
} from "lucide-react";

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
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
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
      <DeadlineBanner leagueId={leagueId} />
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-8">

        {/* ============================================ */}
        {/* HERO: League + Your Status */}
        {/* ============================================ */}
        <div className="relative">
          {/* Background texture */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent rounded-3xl" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />

          <div className="relative p-6 md:p-8">
            {/* Top row: League info + actions */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Trophy className="w-6 h-6 text-amber-900" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                      {league.name}
                    </h1>
                    <p className="text-zinc-500 text-sm">{league.totalRosters} teams • {league.season} Season</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 text-sm font-medium text-zinc-300 hover:text-white transition-all disabled:opacity-50"
                >
                  <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                  <span>{syncing ? "Syncing..." : "Sync"}</span>
                </button>
                <Link
                  href={`/league/${leagueId}/draft-board`}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-sm font-semibold text-black shadow-lg shadow-amber-500/25 transition-all"
                >
                  <Target size={16} />
                  Draft Board
                </Link>
              </div>
            </div>

            {/* Your Team Spotlight */}
            {userRoster && (
              <div className="grid md:grid-cols-3 gap-4">
                {/* Standing */}
                <div className="bg-zinc-900/60 backdrop-blur-sm rounded-2xl p-5 border border-zinc-800/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Your Standing</p>
                      <p className="text-2xl font-bold text-white">
                        #{userRank}
                        <span className="text-base text-zinc-500 font-normal ml-1">of {league.totalRosters}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Record</span>
                    <span className={`font-semibold ${userRoster.wins > userRoster.losses ? "text-emerald-400" : userRoster.wins < userRoster.losses ? "text-red-400" : "text-zinc-300"}`}>
                      {userRoster.wins}-{userRoster.losses}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-zinc-400">Points For</span>
                    <span className="font-semibold text-zinc-300">{Math.round(userRoster.pointsFor).toLocaleString()}</span>
                  </div>
                </div>

                {/* Keepers Status */}
                <div className="bg-zinc-900/60 backdrop-blur-sm rounded-2xl p-5 border border-zinc-800/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Keepers</p>
                      <p className="text-2xl font-bold text-white">
                        {userRoster.keeperCount}
                        <span className="text-base text-zinc-500 font-normal">/{maxKeepers}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Franchise Tags</span>
                    <span className="font-semibold text-amber-400">{franchiseCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-zinc-400">Regular</span>
                    <span className="font-semibold text-zinc-300">{userRoster.keeperCount - franchiseCount}</span>
                  </div>
                </div>

                {/* Quick Action */}
                <Link
                  href={`/league/${leagueId}/team/${userRoster.id}`}
                  className="group bg-gradient-to-br from-amber-500/10 to-amber-600/5 backdrop-blur-sm rounded-2xl p-5 border border-amber-500/20 hover:border-amber-500/40 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-amber-400" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-lg font-semibold text-white mb-1">Manage Keepers</p>
                  <p className="text-sm text-zinc-400">Select and lock your keepers for {league.season}</p>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* YOUR KEEPERS - Featured */}
        {/* ============================================ */}
        {userRoster && userRoster.currentKeepers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                Your {league.season} Keepers
              </h2>
              <Link
                href={`/league/${leagueId}/team/${userRoster.id}`}
                className="text-sm text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
              >
                Manage <ChevronRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {userRoster.currentKeepers.map((keeper) => (
                <div
                  key={keeper.id}
                  className={`relative rounded-xl p-4 ${
                    keeper.type === "FRANCHISE"
                      ? "bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/30"
                      : "bg-zinc-900/60 border border-zinc-800/50"
                  }`}
                >
                  {keeper.type === "FRANCHISE" && (
                    <Crown className="absolute top-2 right-2 w-4 h-4 text-amber-400" />
                  )}
                  <PositionBadge position={keeper.player.position} size="sm" className="mb-2" />
                  <p className="text-sm font-semibold text-white truncate">{keeper.player.fullName}</p>
                  <p className="text-xs text-zinc-500">{keeper.player.team}</p>
                  <div className={`mt-2 text-lg font-bold ${keeper.type === "FRANCHISE" ? "text-amber-400" : "text-zinc-300"}`}>
                    R{keeper.finalCost}
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: maxKeepers - userRoster.currentKeepers.length }).map((_, i) => (
                <Link
                  key={`empty-${i}`}
                  href={`/league/${leagueId}/team/${userRoster.id}`}
                  className="rounded-xl p-4 border-2 border-dashed border-zinc-800 hover:border-zinc-700 flex flex-col items-center justify-center text-zinc-600 hover:text-zinc-400 transition-colors min-h-[120px]"
                >
                  <span className="text-2xl mb-1">+</span>
                  <span className="text-xs">Add Keeper</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* LEADERBOARD */}
        {/* ============================================ */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-zinc-400" />
              League Standings
            </h2>
            <Link
              href={`/league/${leagueId}/team`}
              className="text-sm text-zinc-400 hover:text-white font-medium flex items-center gap-1"
            >
              View All <ChevronRight size={16} />
            </Link>
          </div>

          <div className="space-y-2">
            {sortedRosters.slice(0, 8).map((roster, index) => {
              const rank = index + 1;
              const isUser = roster.isUserRoster;
              const isTop3 = rank <= 3;
              const isPlayoff = rank <= 6;

              return (
                <Link
                  key={roster.id}
                  href={`/league/${leagueId}/team/${roster.id}`}
                  className={`group flex items-center gap-4 p-4 rounded-xl transition-all ${
                    isUser
                      ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20"
                      : "bg-zinc-900/40 hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800/50"
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    rank === 1 ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20" :
                    rank === 2 ? "bg-gradient-to-br from-zinc-300 to-zinc-500" :
                    rank === 3 ? "bg-gradient-to-br from-orange-400 to-orange-600" :
                    isPlayoff ? "bg-emerald-500/10 ring-1 ring-emerald-500/30" :
                    "bg-zinc-800/80"
                  }`}>
                    {rank === 1 ? <Crown className="w-5 h-5 text-amber-900" /> :
                     rank <= 3 ? <span className="text-sm font-bold text-zinc-900">{rank}</span> :
                     <span className={`text-sm font-bold ${isPlayoff ? "text-emerald-400" : "text-zinc-500"}`}>{rank}</span>
                    }
                  </div>

                  {/* Team Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold truncate ${isUser ? "text-amber-200" : "text-white"}`}>
                        {roster.teamName || `Team ${roster.sleeperId}`}
                      </span>
                      {isUser && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 uppercase">
                          You
                        </span>
                      )}
                    </div>
                    {roster.owners?.[0] && (
                      <span className="text-xs text-zinc-500">{roster.owners[0].displayName}</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <span className={`font-semibold ${
                        roster.wins > roster.losses ? "text-emerald-400" :
                        roster.wins < roster.losses ? "text-red-400" : "text-zinc-300"
                      }`}>
                        {roster.wins}-{roster.losses}
                      </span>
                    </div>
                    <div className="text-right w-16">
                      <span className="text-zinc-300 font-medium">{Math.round(roster.pointsFor).toLocaleString()}</span>
                    </div>
                    <div className="w-12 text-center">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                        roster.keeperCount >= maxKeepers ? "bg-emerald-500/10 text-emerald-400" :
                        roster.keeperCount > 0 ? "bg-amber-500/10 text-amber-400" :
                        "bg-zinc-800/50 text-zinc-600"
                      }`}>
                        {roster.keeperCount}/{maxKeepers}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ============================================ */}
        {/* QUICK ACTIONS */}
        {/* ============================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickActionCard
            href={`/league/${leagueId}/draft-board`}
            icon={<Target className="w-5 h-5" />}
            label="Draft Board"
            description="View keeper costs"
            color="amber"
          />
          <QuickActionCard
            href={`/league/${leagueId}/trade-analyzer`}
            icon={<Zap className="w-5 h-5" />}
            label="Trade Analyzer"
            description="Evaluate trades"
            color="emerald"
          />
          <QuickActionCard
            href={`/league/${leagueId}/team`}
            icon={<Users className="w-5 h-5" />}
            label="All Teams"
            description="League rosters"
            color="blue"
          />
          <QuickActionCard
            href={`/league/${leagueId}/settings`}
            icon={<Calendar className="w-5 h-5" />}
            label="Settings"
            description="League rules"
            color="zinc"
          />
        </div>

        {/* Last synced footer */}
        {league.lastSyncedAt && (
          <p className="text-center text-xs text-zinc-600">
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
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: "amber" | "emerald" | "blue" | "zinc";
}) {
  const colors = {
    amber: "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20",
    zinc: "bg-zinc-800/50 text-zinc-400 group-hover:bg-zinc-800/80",
  };

  return (
    <Link
      href={href}
      className="group p-4 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800/50 hover:border-zinc-700/50 transition-all"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${colors[color]}`}>
        {icon}
      </div>
      <p className="font-semibold text-white text-sm">{label}</p>
      <p className="text-xs text-zinc-500">{description}</p>
    </Link>
  );
}

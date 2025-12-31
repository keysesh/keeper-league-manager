"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import {
  Users,
  Trophy,
  Star,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Medal,
  Target,
  Zap
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

interface Roster {
  id: string;
  teamName: string | null;
  owners?: { displayName: string }[];
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  keeperCount?: number;
}

interface LeagueData {
  id: string;
  name: string;
  season: number;
  rosters: Roster[];
}

// Get initials from team name
function getInitials(name: string | null): string {
  if (!name) return "??";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// Get rank styling based on position
function getRankStyle(rank: number): { bg: string; text: string; glow: string; icon?: React.ReactNode } {
  switch (rank) {
    case 1:
      return {
        bg: "bg-gradient-to-br from-amber-400 to-amber-600",
        text: "text-black",
        glow: "shadow-lg shadow-amber-500/30",
        icon: <Crown className="w-4 h-4" />
      };
    case 2:
      return {
        bg: "bg-gradient-to-br from-zinc-300 to-zinc-400",
        text: "text-black",
        glow: "shadow-lg shadow-zinc-400/30",
        icon: <Medal className="w-4 h-4" />
      };
    case 3:
      return {
        bg: "bg-gradient-to-br from-amber-600 to-amber-800",
        text: "text-white",
        glow: "shadow-lg shadow-amber-700/30",
        icon: <Medal className="w-4 h-4" />
      };
    default:
      return {
        bg: "bg-zinc-800/80",
        text: "text-zinc-400",
        glow: ""
      };
  }
}

// Get team avatar gradient based on performance
function getTeamGradient(winPct: number): string {
  if (winPct >= 0.7) return "from-emerald-500 to-emerald-700";
  if (winPct >= 0.5) return "from-violet-500 to-purple-700";
  if (winPct >= 0.3) return "from-amber-500 to-orange-700";
  return "from-zinc-500 to-zinc-700";
}

export default function TeamsPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const { data: league, error, isLoading } = useSWR<LeagueData>(
    `/api/leagues/${leagueId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-10 w-48" />
        </div>
        {/* Podium skeleton */}
        <div className="flex justify-center gap-4 py-8">
          <Skeleton className="w-32 h-40 rounded-2xl" />
          <Skeleton className="w-36 h-48 rounded-2xl" />
          <Skeleton className="w-32 h-36 rounded-2xl" />
        </div>
        <div className="grid gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">Failed to load teams</p>
        </div>
      </div>
    );
  }

  // Sort by wins (desc), then points for (desc)
  const sortedRosters = [...league.rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  const top3 = sortedRosters.slice(0, 3);
  const rest = sortedRosters.slice(3);
  const playoffSpots = Math.min(6, Math.floor(sortedRosters.length / 2));
  const maxPoints = Math.max(...sortedRosters.map(r => r.pointsFor));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
      {/* Header */}
      <div>
        <BackLink href={`/league/${leagueId}`} label="Back to League" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 ring-1 ring-violet-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Standings</h1>
            <p className="text-zinc-500 mt-0.5">{league.name} • {league.season}</p>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {top3.length >= 3 && (
        <div className="relative">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-transparent rounded-3xl" />

          <div className="relative flex items-end justify-center gap-3 md:gap-6 py-6 px-4">
            {/* 2nd Place */}
            <PodiumCard
              roster={top3[1]}
              rank={2}
              leagueId={leagueId}
              maxPoints={maxPoints}
              height="h-44"
            />

            {/* 1st Place */}
            <PodiumCard
              roster={top3[0]}
              rank={1}
              leagueId={leagueId}
              maxPoints={maxPoints}
              height="h-52"
              featured
            />

            {/* 3rd Place */}
            <PodiumCard
              roster={top3[2]}
              rank={3}
              leagueId={leagueId}
              maxPoints={maxPoints}
              height="h-40"
            />
          </div>
        </div>
      )}

      {/* Rest of Teams */}
      <div className="space-y-2">
        {/* Section Header */}
        <div className="flex items-center justify-between px-2 mb-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            All Teams
          </h2>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Playoff
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
              Out
            </span>
          </div>
        </div>

        {sortedRosters.map((roster, index) => {
          const rank = index + 1;
          const totalGames = roster.wins + roster.losses + roster.ties;
          const winPct = totalGames > 0 ? roster.wins / totalGames : 0;
          const isPlayoff = rank <= playoffSpots;
          const isPlayoffLine = rank === playoffSpots;
          const rankStyle = getRankStyle(rank);
          const pointsPct = maxPoints > 0 ? (roster.pointsFor / maxPoints) * 100 : 0;

          return (
            <div key={roster.id}>
              <Link
                href={`/league/${leagueId}/team/${roster.id}`}
                className={`
                  group block rounded-xl p-4 transition-all duration-300
                  bg-[#13111a]/60 backdrop-blur-sm
                  border ${isPlayoff ? "border-emerald-500/20" : "border-white/[0.04]"}
                  hover:border-violet-500/30 hover:bg-[#13111a]/80
                  hover:shadow-lg hover:shadow-violet-500/5
                  hover:scale-[1.01]
                `}
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center
                    text-sm font-bold transition-transform group-hover:scale-110
                    ${rankStyle.bg} ${rankStyle.text} ${rankStyle.glow}
                  `}>
                    {rankStyle.icon || rank}
                  </div>

                  {/* Team Avatar */}
                  <div className={`
                    w-12 h-12 rounded-xl bg-gradient-to-br ${getTeamGradient(winPct)}
                    flex items-center justify-center text-white font-bold text-sm
                    ring-2 ring-white/10 shadow-lg
                  `}>
                    {getInitials(roster.teamName)}
                  </div>

                  {/* Team Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate group-hover:text-violet-200 transition-colors">
                        {roster.teamName || "Unnamed Team"}
                      </span>
                      {rank === 1 && <Crown className="w-4 h-4 text-amber-400" />}
                      {isPlayoff && rank > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                          PLAYOFF
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-500 mt-0.5">
                      {roster.owners?.[0]?.displayName || "Unknown Owner"}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="hidden md:grid grid-cols-3 gap-6 text-center">
                    {/* Record */}
                    <div>
                      <div className="text-lg font-bold text-white">
                        {roster.wins}-{roster.losses}{roster.ties > 0 ? `-${roster.ties}` : ""}
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Record</div>
                    </div>

                    {/* Win % */}
                    <div>
                      <div className={`text-lg font-bold ${
                        winPct >= 0.5 ? "text-emerald-400" : "text-zinc-400"
                      }`}>
                        {(winPct * 100).toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Win Rate</div>
                    </div>

                    {/* Points */}
                    <div>
                      <div className="text-lg font-bold text-violet-400">
                        {roster.pointsFor.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Points</div>
                    </div>
                  </div>

                  {/* Mobile Stats */}
                  <div className="md:hidden text-right">
                    <div className="text-sm font-bold text-white">
                      {roster.wins}-{roster.losses}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {roster.pointsFor.toFixed(0)} PF
                    </div>
                  </div>

                  {/* Keepers Badge */}
                  {roster.keeperCount !== undefined && roster.keeperCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400">{roster.keeperCount}</span>
                    </div>
                  )}

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
                </div>

                {/* Points Progress Bar */}
                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide w-16">Scoring</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${pointsPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-12 text-right">{pointsPct.toFixed(0)}%</span>
                  </div>
                </div>
              </Link>

              {/* Playoff Line Indicator */}
              {isPlayoffLine && rank < sortedRosters.length && (
                <div className="flex items-center gap-3 py-3 px-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
                  <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">
                    Playoff Cutoff
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sortedRosters.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No teams found</p>
          <p className="text-sm text-zinc-600 mt-1">Teams will appear once the league syncs</p>
        </div>
      )}
    </div>
  );
}

// Podium Card Component
function PodiumCard({
  roster,
  rank,
  leagueId,
  maxPoints,
  height,
  featured = false
}: {
  roster: Roster;
  rank: number;
  leagueId: string;
  maxPoints: number;
  height: string;
  featured?: boolean;
}) {
  const totalGames = roster.wins + roster.losses + roster.ties;
  const winPct = totalGames > 0 ? roster.wins / totalGames : 0;
  const rankStyle = getRankStyle(rank);

  return (
    <Link
      href={`/league/${leagueId}/team/${roster.id}`}
      className={`
        group relative flex flex-col items-center justify-end
        w-28 md:w-36 ${height} p-3 rounded-2xl
        bg-gradient-to-b from-[#1a1625] to-[#13111a]
        border border-white/[0.06]
        hover:border-violet-500/30
        transition-all duration-300
        hover:scale-105 hover:-translate-y-1
        ${featured ? "ring-2 ring-amber-500/30 shadow-xl shadow-amber-500/10" : ""}
      `}
    >
      {/* Rank Medal */}
      <div className={`
        absolute -top-3 left-1/2 -translate-x-1/2
        w-8 h-8 rounded-full flex items-center justify-center
        ${rankStyle.bg} ${rankStyle.text} ${rankStyle.glow}
        text-sm font-bold
      `}>
        {rankStyle.icon || rank}
      </div>

      {/* Team Avatar */}
      <div className={`
        w-14 h-14 md:w-16 md:h-16 rounded-xl mb-2
        bg-gradient-to-br ${getTeamGradient(winPct)}
        flex items-center justify-center text-white font-bold
        ring-2 ring-white/20 shadow-lg
        group-hover:scale-110 transition-transform
      `}>
        {getInitials(roster.teamName)}
      </div>

      {/* Team Name */}
      <span className="text-xs md:text-sm font-semibold text-white text-center truncate w-full">
        {roster.teamName || "Unnamed"}
      </span>

      {/* Owner */}
      <span className="text-[10px] text-zinc-500 truncate w-full text-center">
        {roster.owners?.[0]?.displayName || "Unknown"}
      </span>

      {/* Record */}
      <div className="mt-2 px-2 py-1 rounded-lg bg-white/[0.05] text-center">
        <span className="text-xs font-bold text-white">
          {roster.wins}-{roster.losses}
        </span>
        <span className="text-[10px] text-zinc-500 ml-1">
          ({(winPct * 100).toFixed(0)}%)
        </span>
      </div>

      {/* Keepers indicator */}
      {roster.keeperCount !== undefined && roster.keeperCount > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20">
          <Star className="w-2.5 h-2.5 text-amber-400" />
          <span className="text-[10px] font-bold text-amber-400">{roster.keeperCount}</span>
        </div>
      )}
    </Link>
  );
}

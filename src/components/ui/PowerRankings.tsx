"use client";

import { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, Crown, Zap, ChevronRight } from "lucide-react";
import { LEAGUE_CONFIG, getAgeValueModifier, getDraftPickValue } from "@/lib/constants/league-config";
import { InfoModal } from "./InfoModal";
import { cn } from "@/lib/design-tokens";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface KeeperData {
  playerId: string;
  playerName: string;
  position: string | null;
  age: number | null;
  finalCost: number;
  type: "FRANCHISE" | "REGULAR";
  pointsPerGame?: number | null;
}

interface RosterData {
  id: string;
  teamName: string | null;
  wins: number;
  losses: number;
  pointsFor: number;
  keepers: KeeperData[];
  draftPicksOwned: number;
  draftPicksTotal: number;
}

interface PowerRankingsProps {
  rosters?: RosterData[];
  userRosterId?: string;
  leagueId?: string;
  useApi?: boolean;
  condensed?: boolean;
  viewAllHref?: string;
}

interface RankedTeam extends RosterData {
  powerScore: number;
  keeperScore: number;
  recordScore: number;
  draftCapitalScore: number;
  trend: "up" | "down" | "stable";
}

interface ApiPowerRanking {
  rank: number;
  previousRank: number | null;
  change: number;
  rosterId: string;
  teamName: string;
  owners: string[];
  ownerAvatar: string | null;
  overallScore: number;
  grade: string;
  record: {
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
  };
  historicalRecord?: {
    totalWins: number;
    totalLosses: number;
    totalPointsFor: number;
    winPct: number;
    seasonsPlayed: number;
  };
  positionalStrength: Array<{
    position: string;
    score: number;
    grade: string;
  }>;
  keeperValue: number;
  draftCapital: number;
  starPower: number;
  depth: number;
  trajectory: "rising" | "falling" | "stable";
  luckFactor: number;
  luckRating: "lucky" | "unlucky" | "neutral";
  topScorer: {
    playerName: string;
    position: string | null;
    ppg: number;
  } | null;
}

function getAvatarUrl(avatarId: string | null): string | null {
  if (!avatarId) return null;
  if (avatarId.startsWith("http")) return avatarId;
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`;
}

export function PowerRankings({ rosters, userRosterId, leagueId, useApi = false, condensed = false, viewAllHref }: PowerRankingsProps) {
  const { data: apiData, isLoading } = useSWR<{ rankings: ApiPowerRanking[] }>(
    useApi && leagueId ? `/api/leagues/${leagueId}/power-rankings` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const clientRankedTeams = useMemo(() => {
    if (!rosters || rosters.length === 0) return [];

    const teams: RankedTeam[] = rosters.map((roster) => {
      let keeperScore = 0;
      for (const keeper of roster.keepers) {
        const pickValue = getDraftPickValue(keeper.finalCost);
        const ageModifier = getAgeValueModifier(keeper.age, keeper.position);
        const positionMultiplier = LEAGUE_CONFIG.positionScarcity[keeper.position?.toUpperCase() || "WR"] || 1;
        const ppgBonus = keeper.pointsPerGame ? keeper.pointsPerGame * 2 : 0;
        const franchiseBonus = keeper.type === "FRANCHISE" ? 20 : 0;
        keeperScore += (pickValue * ageModifier * positionMultiplier) + ppgBonus + franchiseBonus;
      }

      const totalGames = roster.wins + roster.losses;
      const recordScore = totalGames > 0 ? (roster.wins / totalGames) * 100 : 50;
      const draftCapitalScore = (roster.draftPicksOwned / Math.max(roster.draftPicksTotal, 1)) * 50;
      const powerScore = keeperScore * 0.5 + recordScore * 0.35 + draftCapitalScore * 0.15;

      const avgPointsPerWin = roster.pointsFor / Math.max(roster.wins, 1);
      const trend: "up" | "down" | "stable" =
        avgPointsPerWin > 120 ? "up" : avgPointsPerWin < 100 ? "down" : "stable";

      return { ...roster, powerScore, keeperScore, recordScore, draftCapitalScore, trend };
    });

    return teams.sort((a, b) => b.powerScore - a.powerScore);
  }, [rosters]);

  const useApiData = useApi && apiData?.rankings && apiData.rankings.length > 0;
  const rankings = useApiData ? apiData.rankings : null;
  const rankedTeams = rankings ? [] : clientRankedTeams;

  if (isLoading) {
    return (
      <div className="bg-[#0d1420] border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <div className="h-6 w-40 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="aspect-[4/5] bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!rankings && rankedTeams.length === 0) {
    return (
      <div className="bg-[#0d1420] border border-white/10 rounded-2xl p-10 text-center">
        <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">No rankings available</p>
      </div>
    );
  }

  if (rankings && rankings.length > 0) {
    const displayRankings = condensed ? rankings.slice(0, 5) : rankings;

    return (
      <div className="bg-[#0d1420] border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Power Rankings</h3>
              {!condensed && <p className="text-xs text-slate-500">Season performance analysis</p>}
            </div>
          </div>
          <InfoModal
            title="Power Rankings"
            description="Combined score based on roster strength, record, and draft capital."
            formula={{
              label: "Formula",
              expression: "Roster (50%) + Stars (20%) + Depth (10%) + Keepers (10%) + Picks (10%)",
              variables: [],
            }}
            interpretation={[
              { value: "ROS", meaning: "Roster strength", color: "text-emerald-400" },
              { value: "STR", meaning: "Star power (elite players)", color: "text-blue-400" },
              { value: "DEP", meaning: "Roster depth", color: "text-blue-400" },
              { value: "KPR", meaning: "Keeper value", color: "text-orange-400" },
              { value: "PCK", meaning: "Draft capital", color: "text-purple-400" },
            ]}
            iconSize={16}
          />
        </div>

        {/* Card Grid */}
        <div className={cn(
          "p-4 grid gap-3",
          condensed
            ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        )}>
          {displayRankings.map((team) => {
            const isUser = team.rosterId === userRosterId;
            const avatarUrl = getAvatarUrl(team.ownerAvatar);
            const winPct = team.historicalRecord?.winPct ||
              Math.round((team.record.wins / Math.max(team.record.wins + team.record.losses, 1)) * 100);
            const rosterScore = Math.round(team.positionalStrength.reduce((a, p) => a + p.score, 0) / Math.max(team.positionalStrength.length, 1));

            return (
              <div
                key={team.rosterId}
                className={cn(
                  "relative bg-[#151d2c] rounded-xl p-4 transition-all hover:bg-[#1a2438]",
                  isUser && "ring-1 ring-blue-500/40"
                )}
              >
                {/* Rank Badge - Top Left */}
                <div className={cn(
                  "absolute -top-2 -left-2 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shadow-lg",
                  team.rank === 1 && "bg-amber-500 text-black",
                  team.rank === 2 && "bg-slate-300 text-black",
                  team.rank === 3 && "bg-orange-500 text-white",
                  team.rank > 3 && "bg-slate-700 text-slate-300"
                )}>
                  {team.rank === 1 ? <Crown className="w-3.5 h-3.5" /> : team.rank}
                </div>

                {/* Avatar */}
                <div className="mb-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-700">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 font-semibold text-sm">
                        {(team.owners[0] || "?")[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Name */}
                <h4 className={cn(
                  "text-sm font-semibold truncate mb-0.5",
                  isUser ? "text-blue-400" : "text-white"
                )}>
                  {team.teamName}
                </h4>

                {/* Owner */}
                <p className="text-xs text-slate-500 truncate mb-3">
                  {team.owners[0] || "Unknown"}
                </p>

                {/* Stats Row */}
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white">
                      {team.historicalRecord
                        ? `${team.historicalRecord.totalWins}-${team.historicalRecord.totalLosses}`
                        : `${team.record.wins}-${team.record.losses}`}
                    </span>
                    <span className="text-slate-500 ml-1">{winPct}%</span>
                  </div>
                  {team.trajectory === "rising" && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                  {team.trajectory === "falling" && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                </div>

                {/* Top Scorer */}
                {team.topScorer && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-slate-500 truncate">
                      <span className="text-amber-400">{team.topScorer.ppg}</span>
                      <span className="mx-1">·</span>
                      {team.topScorer.playerName}
                    </p>
                  </div>
                )}

                {/* Stats Breakdown */}
                <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-5 gap-1">
                  <StatChip label="ROS" value={rosterScore} />
                  <StatChip label="STR" value={Math.round(team.starPower * 5)} />
                  <StatChip label="DEP" value={Math.round(team.depth * 10)} />
                  <StatChip label="KPR" value={Math.min(100, Math.round(team.keeperValue * 5))} />
                  <StatChip label="PCK" value={Math.min(100, team.draftCapital)} />
                </div>
              </div>
            );
          })}
        </div>

        {/* View All */}
        {condensed && viewAllHref && rankings.length > 5 && (
          <Link
            href={viewAllHref}
            className="flex items-center justify-center gap-1 py-3 text-xs font-medium text-slate-400 hover:text-white transition-colors border-t border-white/10"
          >
            View all {rankings.length} teams
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    );
  }

  // Fallback client-side rendering
  return (
    <div className="bg-[#0d1420] border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Power Rankings</h3>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {rankedTeams.map((team, index) => {
          const rank = index + 1;
          const isUser = team.id === userRosterId;

          return (
            <div
              key={team.id}
              className={cn(
                "relative bg-[#151d2c] rounded-xl p-4",
                isUser && "ring-1 ring-blue-500/40"
              )}
            >
              <div className={cn(
                "absolute -top-2 -left-2 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shadow-lg",
                rank === 1 && "bg-amber-500 text-black",
                rank === 2 && "bg-slate-300 text-black",
                rank === 3 && "bg-orange-500 text-white",
                rank > 3 && "bg-slate-700 text-slate-300"
              )}>
                {rank === 1 ? <Crown className="w-3.5 h-3.5" /> : rank}
              </div>

              <div className="text-right mb-3">
                <span className="text-lg font-bold text-white">{Math.round(team.powerScore)}</span>
              </div>

              <h4 className={cn(
                "text-sm font-semibold truncate mb-0.5",
                isUser ? "text-blue-400" : "text-white"
              )}>
                {team.teamName || "Unknown"}
              </h4>

              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-slate-400">{team.wins}-{team.losses}</span>
                {team.trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                {team.trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const colorClass = clampedValue >= 80 ? "text-emerald-400" :
    clampedValue >= 60 ? "text-blue-400" :
    clampedValue >= 40 ? "text-slate-400" : "text-orange-400";

  return (
    <div className="text-center">
      <div className={cn("text-xs font-bold", colorClass)}>{Math.round(clampedValue)}</div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  );
}

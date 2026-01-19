"use client";

import { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, Minus, Crown, Zap, ChevronRight, Clover, Star } from "lucide-react";
import { LEAGUE_CONFIG, getAgeValueModifier, getDraftPickValue } from "@/lib/constants/league-config";
import { InfoModal } from "./InfoModal";
import { cn, getGradeGradient } from "@/lib/design-tokens";

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
    seasonBreakdown: Array<{
      season: number;
      wins: number;
      losses: number;
      pointsFor: number;
    }>;
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

// Stat name mapping from abbreviations to full names
const STAT_LABELS: Record<string, string> = {
  ROS: "Roster Strength",
  STR: "Star Power",
  DEP: "Depth",
  KPR: "Keeper Value",
  PCK: "Draft Capital",
};

function getAvatarUrl(avatarId: string | null): string | null {
  if (!avatarId) return null;
  // Check if it's already a URL
  if (avatarId.startsWith("http")) return avatarId;
  // Sleeper CDN URL
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
        avgPointsPerWin > 120 ? "up" :
        avgPointsPerWin < 100 ? "down" : "stable";

      return { ...roster, powerScore, keeperScore, recordScore, draftCapitalScore, trend };
    });

    return teams.sort((a, b) => b.powerScore - a.powerScore);
  }, [rosters]);

  const useApiData = useApi && apiData?.rankings && apiData.rankings.length > 0;
  const rankings = useApiData ? apiData.rankings : null;
  const rankedTeams = rankings ? [] : clientRankedTeams;

  if (isLoading) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse">
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="h-8 w-32 bg-white/[0.05] rounded-lg" />
        </div>
        <div className="p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-80 bg-white/[0.05] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!rankings && rankedTeams.length === 0) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/25 to-blue-500/15 border border-purple-400/30 shadow-lg shadow-purple-500/10 flex items-center justify-center mx-auto mb-3">
          <Zap className="w-6 h-6 text-purple-400" strokeWidth={2} />
        </div>
        <p className="text-base text-slate-400 font-medium">No rankings available</p>
        <p className="text-sm text-slate-600 mt-1">Add rosters to see power rankings</p>
      </div>
    );
  }

  // Render API-based rankings with card grid
  if (rankings && rankings.length > 0) {
    // For condensed mode, show only top 4 cards
    const displayRankings = condensed ? rankings.slice(0, 4) : rankings;

    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-blue-500/15 border border-purple-400/30 shadow-lg shadow-purple-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-400" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Power Rankings</h3>
                {!condensed && (
                  <p className="text-sm text-slate-500">Team cards with full analysis</p>
                )}
              </div>
            </div>
            <InfoModal
              title="Power Rankings"
              description={
                <>
                  Power Rankings combine multiple factors to give you a comprehensive view of each team&apos;s
                  overall strength and competitive position.
                </>
              }
              formula={{
                label: "Score Breakdown",
                expression: "Score = Roster (50%) + Stars (20%) + Depth (10%) + Keepers (10%) + Picks (10%)",
                variables: [
                  { name: "Roster Strength", description: "Positional strength across QB, RB, WR, TE" },
                  { name: "Star Power", description: "Impact of top performers (high PPG players)" },
                  { name: "Depth", description: "Quality of bench and backup players" },
                  { name: "Keeper Value", description: "Value of locked keeper assets" },
                  { name: "Draft Capital", description: "Future draft capital owned" },
                ],
              }}
              interpretation={[
                { value: "A+", meaning: "Elite - Championship favorite", color: "text-amber-400" },
                { value: "A / A-", meaning: "Contender - Strong roster", color: "text-emerald-400" },
                { value: "B+", meaning: "Playoff team - Competitive", color: "text-blue-400" },
                { value: "B / B-", meaning: "Bubble team - On the fringe", color: "text-blue-400" },
                { value: "C+", meaning: "Rebuilding - Some pieces", color: "text-slate-400" },
                { value: "C / C-", meaning: "Rebuilding - Needs work", color: "text-slate-400" },
                { value: "D+", meaning: "Struggling - Major gaps", color: "text-orange-400" },
                { value: "D / F", meaning: "Full rebuild mode", color: "text-red-400" },
              ]}
              sections={[
                {
                  title: "Trajectory Indicators",
                  content: (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span><strong className="text-emerald-400">Rising</strong> - Team is improving</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <span><strong className="text-red-400">Falling</strong> - Team is declining</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Minus className="w-4 h-4 text-slate-400" />
                        <span><strong className="text-slate-400">Stable</strong> - Consistent performance</span>
                      </div>
                    </div>
                  ),
                },
              ]}
              iconSize={18}
            />
          </div>
        </div>

        {/* Card Grid Layout - More horizontal cards */}
        <div className={cn(
          "p-4 grid gap-4",
          condensed
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1 lg:grid-cols-2"
        )}>
          {displayRankings.map((team) => {
            const isUser = team.rosterId === userRosterId;
            const gradeGradient = getGradeGradient(team.grade);
            const avatarUrl = getAvatarUrl(team.ownerAvatar);
            const rosterScore = Math.round(team.positionalStrength.reduce((a, p) => a + p.score, 0) / Math.max(team.positionalStrength.length, 1));

            return (
              <div
                key={team.rosterId}
                className={cn(
                  "relative bg-[#131a28] border rounded-xl overflow-hidden transition-all duration-200 hover:border-white/[0.15] hover:shadow-lg hover:shadow-purple-500/5",
                  isUser ? "border-blue-500/30 ring-1 ring-blue-500/20" : "border-white/[0.08]"
                )}
              >
                {/* Horizontal Card Layout */}
                <div className="flex">
                  {/* Left: Rank + Avatar + Team Info */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start gap-3">
                      {/* Rank Badge */}
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0",
                        team.rank === 1 && "bg-amber-500 text-black",
                        team.rank === 2 && "bg-slate-400 text-black",
                        team.rank === 3 && "bg-orange-600 text-white",
                        team.rank > 3 && "bg-white/[0.08] text-slate-400"
                      )}>
                        {team.rank === 1 ? <Crown className="w-4 h-4" /> : `#${team.rank}`}
                      </div>

                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={team.owners[0] || "Owner"}
                            width={40}
                            height={40}
                            className="rounded-lg object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm">
                            {(team.owners[0] || "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Team Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={cn(
                            "text-sm font-semibold truncate",
                            isUser ? "text-blue-400" : "text-white"
                          )}>
                            {team.teamName}
                          </h4>
                          {isUser && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-bold uppercase flex-shrink-0">
                              You
                            </span>
                          )}
                          {team.trajectory === "rising" && (
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          )}
                          {team.trajectory === "falling" && (
                            <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{team.owners[0] || "Unknown"}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          <span className="font-medium">
                            {team.historicalRecord
                              ? `${team.historicalRecord.totalWins}-${team.historicalRecord.totalLosses}`
                              : `${team.record.wins}-${team.record.losses}`}
                          </span>
                          <span>{team.historicalRecord?.winPct || Math.round((team.record.wins / Math.max(team.record.wins + team.record.losses, 1)) * 100)}% win</span>
                          {team.topScorer && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-amber-400/80 truncate">
                                <Star className="w-3 h-3 inline mr-0.5" />
                                {team.topScorer.playerName.split(' ').pop()} {team.topScorer.ppg}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats Breakdown - Only show in full mode */}
                    {!condensed && (
                      <div className="mt-4 grid grid-cols-5 gap-2">
                        <StatChip label="ROS" value={rosterScore} />
                        <StatChip label="STR" value={Math.round(team.starPower * 5)} />
                        <StatChip label="DEP" value={Math.round(team.depth * 10)} />
                        <StatChip label="KPR" value={Math.min(100, Math.round(team.keeperValue * 5))} />
                        <StatChip label="PCK" value={Math.min(100, team.draftCapital)} />
                      </div>
                    )}
                  </div>

                  {/* Right: Grade + Luck */}
                  <div className="flex flex-col items-center justify-center px-4 py-3 border-l border-white/[0.06] bg-white/[0.02] min-w-[80px]">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white bg-gradient-to-br shadow-lg",
                      gradeGradient
                    )}>
                      {team.grade}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">{team.overallScore} pts</span>
                    <div className={cn(
                      "mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
                      team.luckRating === "lucky" ? "bg-emerald-500/15 text-emerald-400" :
                      team.luckRating === "unlucky" ? "bg-red-500/15 text-red-400" :
                      "bg-slate-500/15 text-slate-400"
                    )}>
                      <Clover className="w-3 h-3" />
                      {team.luckFactor > 0 ? "+" : ""}{team.luckFactor}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All link for condensed mode */}
        {condensed && viewAllHref && rankings.length > 4 && (
          <Link
            href={viewAllHref}
            className="group flex items-center justify-center gap-1 py-3 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors hover:bg-white/[0.02] border-t border-white/[0.06]"
          >
            View All ({rankings.length})
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>
    );
  }

  // Fallback client-side rendering (simple card layout)
  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-blue-500/15 border border-purple-400/30 shadow-lg shadow-purple-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-purple-400" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Power Rankings</h3>
            <p className="text-sm text-slate-500">Based on keepers, record & draft capital</p>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {rankedTeams.map((team, index) => {
          const rank = index + 1;
          const isUser = team.id === userRosterId;

          return (
            <div
              key={team.id}
              className={cn(
                "bg-[#131a28] border rounded-xl p-4 transition-all duration-200 hover:border-white/[0.15]",
                isUser ? "border-blue-500/30" : "border-white/[0.08]"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-base",
                  rank === 1 && "bg-amber-500 text-black",
                  rank === 2 && "bg-slate-400 text-black",
                  rank === 3 && "bg-orange-600 text-white",
                  rank > 3 && "bg-white/[0.05] text-slate-400"
                )}>
                  {rank === 1 ? <Crown className="w-5 h-5" /> : rank}
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">{Math.round(team.powerScore)}</div>
                  <div className="text-xs text-slate-500">PWR</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  "text-sm font-medium truncate",
                  isUser ? "text-blue-400" : "text-white"
                )}>
                  {team.teamName || `Team ${team.id.slice(0, 6)}`}
                </span>
                {isUser && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-bold uppercase">
                    You
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="font-medium">{team.wins}-{team.losses}</span>
                <span>{team.keepers.length} keepers</span>
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

// Stat Chip Component for horizontal layout
function StatChip({ label, value }: { label: string; value: number }) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const colorClass = clampedValue >= 80 ? "text-emerald-400" :
    clampedValue >= 60 ? "text-blue-400" :
    clampedValue >= 40 ? "text-slate-400" : "text-orange-400";

  return (
    <div className="text-center">
      <div className={cn("text-sm font-bold", colorClass)}>{Math.round(clampedValue)}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

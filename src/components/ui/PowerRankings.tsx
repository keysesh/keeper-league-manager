"use client";

import { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Crown, Shield, Zap, ChevronUp, ChevronDown, ChevronRight } from "lucide-react";
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

  const maxScore = useApiData
    ? Math.max(...(rankings?.map(r => r.overallScore) || [1]), 1)
    : Math.max(...rankedTeams.map(t => t.powerScore), 1);

  if (isLoading) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse">
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="h-8 w-32 bg-white/[0.05] rounded-lg" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-white/[0.05] rounded-lg" />
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

  const getCondensedItems = <T extends { rosterId?: string; id?: string }>(
    items: T[],
    userId: string | undefined
  ): { items: Array<T & { showSeparator?: boolean }>; hasMore: boolean } => {
    if (items.length <= 6) {
      return { items: items.map(item => ({ ...item })), hasMore: false };
    }

    const top3 = items.slice(0, 3);
    const bottom2 = items.slice(-2);
    const userIndex = userId ? items.findIndex(item => (item.rosterId || item.id) === userId) : -1;
    const userInTop = userIndex >= 0 && userIndex < 3;
    const userInBottom = userIndex >= items.length - 2;

    if (userInTop || userInBottom || userIndex === -1) {
      return {
        items: [
          ...top3.map(item => ({ ...item })),
          { ...items[3], showSeparator: true } as T & { showSeparator?: boolean },
          ...bottom2.map(item => ({ ...item })),
        ],
        hasMore: true,
      };
    }

    return {
      items: [
        ...top3.map(item => ({ ...item })),
        { ...items[userIndex], showSeparator: true } as T & { showSeparator?: boolean },
        ...bottom2.map(item => ({ ...item })),
      ],
      hasMore: true,
    };
  };

  // Render API-based rankings
  if (rankings && rankings.length > 0) {
    const { items: displayRankings, hasMore } = condensed
      ? getCondensedItems(rankings, userRosterId)
      : { items: rankings.map(r => ({ ...r })), hasMore: false };

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
                  <p className="text-sm text-slate-500">
                    <span className="hidden sm:inline">ROS 50% · STR 20% · DEP 10% · KPR 10% · PCK 10%</span>
                    <span className="sm:hidden">Roster + Stars + Depth + Keepers + Picks</span>
                  </p>
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
                  { name: "Roster", description: "Positional strength across QB, RB, WR, TE" },
                  { name: "Stars", description: "Impact of top performers (high PPG players)" },
                  { name: "Depth", description: "Quality of bench and backup players" },
                  { name: "Keepers", description: "Value of locked keeper assets" },
                  { name: "Picks", description: "Future draft capital owned" },
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

        <div className="divide-y divide-white/[0.06]">
          {displayRankings.map((team) => {
            const teamWithSeparator = team as typeof team & { showSeparator?: boolean };
            const isUser = team.rosterId === userRosterId;
            const barWidth = (team.overallScore / maxScore) * 100;
            const gradeGradient = getGradeGradient(team.grade);

            const changeIcon = team.change > 0 ? (
              <span className="flex items-center text-emerald-400 text-xs font-medium">
                <ChevronUp className="w-3 h-3" />{team.change}
              </span>
            ) : team.change < 0 ? (
              <span className="flex items-center text-red-400 text-xs font-medium">
                <ChevronDown className="w-3 h-3" />{Math.abs(team.change)}
              </span>
            ) : null;

            return (
              <div key={team.rosterId}>
                {teamWithSeparator.showSeparator && (
                  <div className="flex items-center gap-2 py-1.5 px-4">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
                    <span className="text-xs text-slate-600">...</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
                  </div>
                )}
                <div
                  className={cn(
                    "p-3 sm:p-4 transition-colors",
                    isUser ? "bg-blue-500/5" : "hover:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Rank with change */}
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <div className={cn(
                        "w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-bold text-sm",
                        team.rank === 1 && "bg-amber-500 text-black",
                        team.rank === 2 && "bg-slate-400 text-black",
                        team.rank === 3 && "bg-orange-600 text-white",
                        team.rank > 3 && "bg-white/[0.05] text-slate-400"
                      )}>
                        {team.rank === 1 ? <Crown className="w-4 h-4 sm:w-5 sm:h-5" /> : team.rank}
                      </div>
                      {!condensed && changeIcon}
                    </div>

                    {/* Team info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-sm sm:text-base font-medium truncate",
                          isUser ? "text-blue-400" : "text-white"
                        )}>
                          {team.teamName}
                        </span>
                        {isUser && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-bold uppercase">
                            You
                          </span>
                        )}
                        {team.trajectory === "rising" && (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        {team.trajectory === "falling" && (
                          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>

                      {/* Power bar - only show in full mode */}
                      {!condensed && (
                        <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500 bg-gradient-to-r",
                              gradeGradient
                            )}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      )}

                      {/* Stats row */}
                      <div className={cn(
                        "flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-500",
                        condensed ? "mt-1" : "mt-2"
                      )}>
                        <span className="font-medium">
                          {team.historicalRecord
                            ? `${team.historicalRecord.totalWins}-${team.historicalRecord.totalLosses}`
                            : `${team.record.wins}-${team.record.losses}`
                          }
                        </span>
                        {!condensed && team.historicalRecord && (
                          <span>{team.historicalRecord.winPct}% win</span>
                        )}
                        {!condensed && <span className="hidden sm:inline">★ {team.starPower.toFixed(1)} PPG</span>}
                      </div>

                      {/* Component Score Breakdown */}
                      {!condensed && (
                        <div className="mt-3 flex items-center gap-1 flex-wrap">
                          <ScoreChip label="ROS" value={Math.round(team.positionalStrength.reduce((a, p) => a + p.score, 0) / Math.max(team.positionalStrength.length, 1))} tooltip="Roster (50%)" />
                          <ScoreChip label="STR" value={Math.round(team.starPower)} tooltip="Stars (20%)" />
                          <ScoreChip label="DEP" value={Math.round(team.depth)} tooltip="Depth (10%)" />
                          <ScoreChip label="KPR" value={Math.round(team.keeperValue)} tooltip="Keepers (10%)" />
                          <ScoreChip label="PCK" value={Math.round(team.draftCapital)} tooltip="Picks (10%)" />
                        </div>
                      )}
                    </div>

                    {/* Grade badge */}
                    <div className="flex-shrink-0">
                      <div className={cn(
                        "w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold text-base sm:text-lg text-white bg-gradient-to-br shadow-lg",
                        gradeGradient
                      )}>
                        {team.grade}
                      </div>
                      {!condensed && (
                        <div className="text-xs text-slate-500 text-center mt-1">{team.overallScore} pts</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All link */}
        {condensed && hasMore && viewAllHref && (
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

  // ScoreChip component for breakdown display
  function ScoreChip({ label, value, tooltip }: { label: string; value: number; tooltip: string }) {
    return (
      <div
        className="px-2 py-1 rounded bg-white/[0.04] border border-white/[0.06] text-[11px] flex items-center gap-1.5 group relative cursor-help"
        title={tooltip}
      >
        <span className="text-slate-500 font-medium">{label}</span>
        <span className="text-white font-bold">{value}</span>
      </div>
    );
  }

  // Fallback client-side rendering
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

      <div className="divide-y divide-white/[0.06]">
        {rankedTeams.map((team, index) => {
          const rank = index + 1;
          const isUser = team.id === userRosterId;
          const barWidth = (team.powerScore / maxScore) * 100;

          return (
            <div
              key={team.id}
              className={cn(
                "p-4 transition-colors",
                isUser ? "bg-blue-500/5" : "hover:bg-white/[0.02]"
              )}
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0",
                  rank === 1 && "bg-amber-500 text-black",
                  rank === 2 && "bg-slate-400 text-black",
                  rank === 3 && "bg-orange-600 text-white",
                  rank > 3 && "bg-white/[0.05] text-slate-400"
                )}>
                  {rank === 1 ? <Crown className="w-5 h-5" /> : rank}
                </div>

                {/* Team info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-base font-medium truncate",
                      isUser ? "text-blue-400" : "text-white"
                    )}>
                      {team.teamName || `Team ${team.id.slice(0, 6)}`}
                    </span>
                    {isUser && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-bold uppercase">
                        You
                      </span>
                    )}
                    {team.trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                    {team.trend === "down" && <TrendingDown className="w-4 h-4 text-red-400" />}
                  </div>

                  {/* Power bar */}
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        rank === 1 && "bg-amber-500",
                        rank <= 3 && rank > 1 && "bg-emerald-500",
                        rank <= 6 && rank > 3 && "bg-blue-500",
                        rank > 6 && "bg-slate-500"
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" />
                      {team.keepers.length} keepers
                    </span>
                    <span className="font-medium">{team.wins}-{team.losses}</span>
                    <span>{team.draftPicksOwned}/{team.draftPicksTotal} picks</span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-bold text-white">{Math.round(team.powerScore)}</div>
                  <div className="text-xs text-slate-500">PWR</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

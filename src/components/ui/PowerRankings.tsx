"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { TrendingUp, TrendingDown, Minus, Crown, Shield, Zap, ChevronUp, ChevronDown, Info } from "lucide-react";
import { LEAGUE_CONFIG, getAgeValueModifier, getDraftPickValue } from "@/lib/constants/league-config";

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
}

interface RankedTeam extends RosterData {
  powerScore: number;
  keeperScore: number;
  recordScore: number;
  draftCapitalScore: number;
  trend: "up" | "down" | "stable";
}

// API response types
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

/**
 * Power Rankings component
 * Can use API data or calculate client-side based on props
 */
export function PowerRankings({ rosters, userRosterId, leagueId, useApi = false }: PowerRankingsProps) {
  // Fetch from API if leagueId provided and useApi is true
  const { data: apiData, isLoading } = useSWR<{ rankings: ApiPowerRanking[] }>(
    useApi && leagueId ? `/api/leagues/${leagueId}/power-rankings` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  // Client-side calculation (fallback)
  const clientRankedTeams = useMemo(() => {
    if (!rosters || rosters.length === 0) return [];

    const teams: RankedTeam[] = rosters.map((roster) => {
      // Calculate keeper value score
      let keeperScore = 0;
      for (const keeper of roster.keepers) {
        const pickValue = getDraftPickValue(keeper.finalCost);
        const ageModifier = getAgeValueModifier(keeper.age, keeper.position);
        const positionMultiplier = LEAGUE_CONFIG.positionScarcity[keeper.position?.toUpperCase() || "WR"] || 1;
        const ppgBonus = keeper.pointsPerGame ? keeper.pointsPerGame * 2 : 0;
        const franchiseBonus = keeper.type === "FRANCHISE" ? 20 : 0;

        keeperScore += (pickValue * ageModifier * positionMultiplier) + ppgBonus + franchiseBonus;
      }

      // Calculate record score (win percentage * 100)
      const totalGames = roster.wins + roster.losses;
      const recordScore = totalGames > 0 ? (roster.wins / totalGames) * 100 : 50;

      // Calculate draft capital score
      const draftCapitalScore = (roster.draftPicksOwned / Math.max(roster.draftPicksTotal, 1)) * 50;

      // Combined power score (weighted)
      const powerScore =
        keeperScore * 0.5 +      // 50% keepers
        recordScore * 0.35 +     // 35% record
        draftCapitalScore * 0.15; // 15% draft capital

      // Trend based on points differential (simplified)
      const avgPointsPerWin = roster.pointsFor / Math.max(roster.wins, 1);
      const trend: "up" | "down" | "stable" =
        avgPointsPerWin > 120 ? "up" :
        avgPointsPerWin < 100 ? "down" : "stable";

      return {
        ...roster,
        powerScore,
        keeperScore,
        recordScore,
        draftCapitalScore,
        trend,
      };
    });

    // Sort by power score descending
    return teams.sort((a, b) => b.powerScore - a.powerScore);
  }, [rosters]);

  // Use API data if available, otherwise client calculation
  const useApiData = useApi && apiData?.rankings && apiData.rankings.length > 0;
  const rankings = useApiData ? apiData.rankings : null;
  const rankedTeams = rankings ? [] : clientRankedTeams;

  const maxScore = useApiData
    ? Math.max(...(rankings?.map(r => r.overallScore) || [1]), 1)
    : Math.max(...rankedTeams.map(t => t.powerScore), 1);

  if (isLoading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <div className="h-8 w-32 bg-[#2a2a2a] rounded" />
        </div>
        <div className="p-3 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-[#2a2a2a] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!rankings && rankedTeams.length === 0) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <Zap className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">No rankings available</p>
        <p className="text-xs text-gray-600 mt-1">Add rosters to see power rankings</p>
      </div>
    );
  }

  // Grade color mapping
  const gradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-emerald-400";
    if (grade.startsWith("B")) return "text-blue-400";
    if (grade.startsWith("C")) return "text-yellow-400";
    if (grade.startsWith("D")) return "text-orange-400";
    return "text-red-400";
  };

  // Render API-based rankings
  if (rankings && rankings.length > 0) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Power Rankings</h3>
                <p className="text-[10px] text-gray-500">50% roster · 20% stars · 10% depth · 10% keepers · 10% picks</p>
              </div>
            </div>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
              <div className="absolute right-0 top-6 w-48 p-2 bg-[#222] border border-[#333] rounded-lg text-[10px] text-gray-400 hidden group-hover:block z-10">
                Rankings based on positional strength, star power, roster depth, keeper value, and draft capital.
              </div>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#2a2a2a]">
          {rankings.map((team) => {
            const isUser = team.rosterId === userRosterId;
            const barWidth = (team.overallScore / maxScore) * 100;
            const changeIcon = team.change > 0 ? (
              <span className="flex items-center text-emerald-400 text-[10px]">
                <ChevronUp className="w-3 h-3" />{team.change}
              </span>
            ) : team.change < 0 ? (
              <span className="flex items-center text-red-400 text-[10px]">
                <ChevronDown className="w-3 h-3" />{Math.abs(team.change)}
              </span>
            ) : null;

            return (
              <div
                key={team.rosterId}
                className={`p-3 transition-colors ${
                  isUser ? "bg-blue-500/5" : "hover:bg-[#222]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank with change */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm ${
                      team.rank === 1 ? "bg-yellow-500 text-black" :
                      team.rank === 2 ? "bg-gray-400 text-black" :
                      team.rank === 3 ? "bg-orange-600 text-white" :
                      "bg-[#2a2a2a] text-gray-400"
                    }`}>
                      {team.rank === 1 ? <Crown className="w-4 h-4" /> : team.rank}
                    </div>
                    {changeIcon}
                  </div>

                  {/* Team info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate ${isUser ? "text-blue-400" : "text-white"}`}>
                        {team.teamName}
                      </span>
                      {isUser && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-bold">
                          YOU
                        </span>
                      )}
                      {/* Trajectory badge */}
                      {team.trajectory === "rising" && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                          <TrendingUp className="w-2.5 h-2.5" /> Rising
                        </span>
                      )}
                      {team.trajectory === "falling" && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                          <TrendingDown className="w-2.5 h-2.5" /> Falling
                        </span>
                      )}
                    </div>

                    {/* Power bar */}
                    <div className="mt-1.5 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          team.rank === 1 ? "bg-yellow-500" :
                          team.rank <= 3 ? "bg-emerald-500" :
                          team.rank <= 6 ? "bg-blue-500" :
                          "bg-gray-500"
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {/* Breakdown */}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                      <span>{team.record.wins}-{team.record.losses}</span>
                      <span>★ {team.starPower.toFixed(1)} PPG</span>
                      <span>Depth: {team.depth.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Score and Grade */}
                  <div className="text-right flex-shrink-0">
                    <div className={`text-lg font-bold ${gradeColor(team.grade)}`}>{team.grade}</div>
                    <div className="text-[9px] text-gray-500">{team.overallScore} pts</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render client-side calculated rankings (fallback)
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Power Rankings</h3>
            <p className="text-[10px] text-gray-500">Based on keepers, record & draft capital</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-[#2a2a2a]">
        {rankedTeams.map((team, index) => {
          const rank = index + 1;
          const isUser = team.id === userRosterId;
          const barWidth = (team.powerScore / maxScore) * 100;

          return (
            <div
              key={team.id}
              className={`p-3 transition-colors ${
                isUser ? "bg-blue-500/5" : "hover:bg-[#222]"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  rank === 1 ? "bg-yellow-500 text-black" :
                  rank === 2 ? "bg-gray-400 text-black" :
                  rank === 3 ? "bg-orange-600 text-white" :
                  "bg-[#2a2a2a] text-gray-400"
                }`}>
                  {rank === 1 ? <Crown className="w-4 h-4" /> : rank}
                </div>

                {/* Team info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${isUser ? "text-blue-400" : "text-white"}`}>
                      {team.teamName || `Team ${team.id.slice(0, 6)}`}
                    </span>
                    {isUser && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-bold">
                        YOU
                      </span>
                    )}
                    {/* Trend indicator */}
                    {team.trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                    {team.trend === "down" && <TrendingDown className="w-3 h-3 text-red-400" />}
                    {team.trend === "stable" && <Minus className="w-3 h-3 text-gray-500" />}
                  </div>

                  {/* Power bar */}
                  <div className="mt-1.5 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        rank === 1 ? "bg-yellow-500" :
                        rank <= 3 ? "bg-emerald-500" :
                        rank <= 6 ? "bg-blue-500" :
                        "bg-gray-500"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Breakdown */}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" />
                      {team.keepers.length} keepers
                    </span>
                    <span>{team.wins}-{team.losses}</span>
                    <span>{team.draftPicksOwned}/{team.draftPicksTotal} picks</span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-white">{Math.round(team.powerScore)}</div>
                  <div className="text-[9px] text-gray-500">PWR</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

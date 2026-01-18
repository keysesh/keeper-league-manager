"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Crown, Shield, Zap } from "lucide-react";
import { LEAGUE_CONFIG, getAgeValueModifier, getDraftPickValue } from "@/lib/constants/league-config";

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
  rosters: RosterData[];
  userRosterId?: string;
}

interface RankedTeam extends RosterData {
  powerScore: number;
  keeperScore: number;
  recordScore: number;
  draftCapitalScore: number;
  trend: "up" | "down" | "stable";
}

/**
 * Power Rankings component
 * Calculates team strength based on keepers, record, and draft capital
 */
export function PowerRankings({ rosters, userRosterId }: PowerRankingsProps) {
  const rankedTeams = useMemo(() => {
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

  const maxScore = Math.max(...rankedTeams.map(t => t.powerScore), 1);

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

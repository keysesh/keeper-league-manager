"use client";

import useSWR from "swr";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, ChevronRight, BarChart3, Trophy, Clover } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface UserStatsHeroProps {
  leagueId: string;
  roster: {
    id: string;
    teamName: string | null;
    wins: number;
    losses: number;
    pointsFor: number;
    keeperCount: number;
  };
  rank: number;
  totalRosters: number;
  maxKeepers: number;
}

interface PowerRanking {
  rank: number;
  rosterId: string;
  overallScore: number;
  grade: string;
  trajectory: "rising" | "falling" | "stable";
}

interface LuckRating {
  rosterId: string;
  luckFactor: number;
  luckRating: string;
}

export function UserStatsHero({
  leagueId,
  roster,
  rank,
  totalRosters,
  maxKeepers,
}: UserStatsHeroProps) {
  // Fetch power rankings to get user's power score
  const { data: powerData } = useSWR<{ rankings: PowerRanking[] }>(
    `/api/leagues/${leagueId}/power-rankings`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  // Fetch luck factor
  const { data: luckData } = useSWR<{ luckRatings: LuckRating[] }>(
    `/api/leagues/${leagueId}/luck-factor`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const userPowerRanking = powerData?.rankings?.find(r => r.rosterId === roster.id);
  const userLuck = luckData?.luckRatings?.find(r => r.rosterId === roster.id);

  const gradeColor = (grade: string) => {
    if (!grade) return "text-gray-400";
    if (grade.startsWith("A")) return "text-emerald-400";
    if (grade.startsWith("B")) return "text-blue-400";
    if (grade.startsWith("C")) return "text-yellow-400";
    if (grade.startsWith("D")) return "text-orange-400";
    return "text-red-400";
  };

  const TrendIcon = userPowerRanking?.trajectory === "rising"
    ? TrendingUp
    : userPowerRanking?.trajectory === "falling"
    ? TrendingDown
    : Minus;

  const trendColor = userPowerRanking?.trajectory === "rising"
    ? "text-emerald-400"
    : userPowerRanking?.trajectory === "falling"
    ? "text-red-400"
    : "text-gray-500";

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md overflow-hidden">
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {roster.teamName || "Your Team"}
              </h2>
              <p className="text-sm text-gray-500">Season Overview</p>
            </div>
          </div>
          <Link
            href={`/league/${leagueId}/team/${roster.id}`}
            className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 font-medium transition-colors"
          >
            View Team <ChevronRight size={16} />
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Standing */}
          <div className="bg-[#222] rounded-md p-3 border border-[#2a2a2a]">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500 font-medium">Rank</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">#{rank}</span>
              <span className="text-sm text-gray-500">/ {totalRosters}</span>
            </div>
          </div>

          {/* Record */}
          <div className="bg-[#222] rounded-md p-3 border border-[#2a2a2a]">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-500 font-medium">Record</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${
                roster.wins > roster.losses ? "text-green-500" :
                roster.wins < roster.losses ? "text-red-500" : "text-white"
              }`}>
                {roster.wins}-{roster.losses}
              </span>
            </div>
          </div>

          {/* Power Score */}
          <div className="bg-[#222] rounded-md p-3 border border-[#2a2a2a]">
            <div className="flex items-center gap-2 mb-1">
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
              <span className="text-xs text-gray-500 font-medium">Power</span>
            </div>
            <div className="flex items-baseline gap-2">
              {userPowerRanking ? (
                <>
                  <span className={`text-2xl font-bold ${gradeColor(userPowerRanking.grade)}`}>
                    {userPowerRanking.grade}
                  </span>
                  <span className="text-sm text-gray-500">
                    #{userPowerRanking.rank}
                  </span>
                </>
              ) : (
                <span className="text-xl font-bold text-gray-500">--</span>
              )}
            </div>
          </div>

          {/* Luck Factor */}
          <div className="bg-[#222] rounded-md p-3 border border-[#2a2a2a]">
            <div className="flex items-center gap-2 mb-1">
              <Clover className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-gray-500 font-medium">Luck</span>
            </div>
            <div className="flex items-baseline gap-1">
              {userLuck ? (
                <span className={`text-2xl font-bold ${
                  userLuck.luckFactor > 0 ? "text-emerald-400" :
                  userLuck.luckFactor < 0 ? "text-red-400" : "text-gray-400"
                }`}>
                  {userLuck.luckFactor > 0 ? "+" : ""}{userLuck.luckFactor}
                </span>
              ) : (
                <span className="text-xl font-bold text-gray-500">--</span>
              )}
            </div>
          </div>
        </div>

        {/* Keepers Progress */}
        <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Keepers Selected</span>
            <span className="text-sm font-medium text-white">
              {roster.keeperCount} / {maxKeepers}
            </span>
          </div>
          <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                roster.keeperCount >= maxKeepers ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${(roster.keeperCount / maxKeepers) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserStatsHero;

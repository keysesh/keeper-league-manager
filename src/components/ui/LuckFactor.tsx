"use client";

import useSWR from "swr";
import { Clover, TrendingUp, TrendingDown, Minus, Info, Frown, Smile } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface LuckRating {
  rosterId: string;
  teamName: string;
  owners: string[];
  wins: number;
  losses: number;
  pointsFor: number;
  pointsForRank: number;
  expectedWins: number;
  actualWins: number;
  luckFactor: number;
  luckRating: "very_lucky" | "lucky" | "neutral" | "unlucky" | "very_unlucky";
  scheduleStrength: number;
}

interface LuckFactorProps {
  leagueId: string;
  userRosterId?: string;
}

const ratingConfig = {
  very_lucky: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
    label: "Very Lucky",
    icon: Smile,
  },
  lucky: {
    color: "text-green-400",
    bg: "bg-green-500/20",
    border: "border-green-500/30",
    label: "Lucky",
    icon: TrendingUp,
  },
  neutral: {
    color: "text-gray-400",
    bg: "bg-gray-500/20",
    border: "border-gray-500/30",
    label: "Neutral",
    icon: Minus,
  },
  unlucky: {
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    border: "border-orange-500/30",
    label: "Unlucky",
    icon: TrendingDown,
  },
  very_unlucky: {
    color: "text-red-400",
    bg: "bg-red-500/20",
    border: "border-red-500/30",
    label: "Very Unlucky",
    icon: Frown,
  },
};

/**
 * Luck Factor visualization
 * Shows which teams have over/underperformed based on their points scored
 */
export function LuckFactor({ leagueId, userRosterId }: LuckFactorProps) {
  const { data, isLoading, error } = useSWR<{
    luckRatings: LuckRating[];
    leagueStats: {
      totalTeams: number;
      gamesPerTeam: number;
      avgLeaguePoints: number;
      luckiestTeam: string;
      unluckiestTeam: string;
    };
  }>(
    `/api/leagues/${leagueId}/luck-factor`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <div className="h-8 w-32 bg-[#2a2a2a] rounded" />
        </div>
        <div className="p-3 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-[#2a2a2a] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.luckRatings) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <Clover className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">Luck data unavailable</p>
        <p className="text-xs text-gray-600 mt-1">Play more games to see luck factors</p>
      </div>
    );
  }

  const { luckRatings, leagueStats } = data;
  const maxLuck = Math.max(...luckRatings.map(r => Math.abs(r.luckFactor)), 1);

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Clover className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Luck Factor</h3>
              <p className="text-[10px] text-gray-500">Actual wins vs expected based on points scored</p>
            </div>
          </div>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
            <div className="absolute right-0 top-6 w-52 p-2 bg-[#222] border border-[#333] rounded-lg text-[10px] text-gray-400 hidden group-hover:block z-10">
              Luck = Actual Wins - Expected Wins. Expected wins based on your points scored relative to the league.
            </div>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-2 p-3 border-b border-[#2a2a2a]">
        <div className="bg-[#222] rounded-md p-2 text-center">
          <Smile className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-[10px] text-gray-500">Luckiest</p>
          <p className="text-xs font-medium text-white truncate">{leagueStats.luckiestTeam}</p>
        </div>
        <div className="bg-[#222] rounded-md p-2 text-center">
          <Frown className="w-4 h-4 text-red-400 mx-auto mb-1" />
          <p className="text-[10px] text-gray-500">Unluckiest</p>
          <p className="text-xs font-medium text-white truncate">{leagueStats.unluckiestTeam}</p>
        </div>
      </div>

      {/* Luck ratings list */}
      <div className="divide-y divide-[#2a2a2a]">
        {luckRatings.map((team) => {
          const isUser = team.rosterId === userRosterId;
          const config = ratingConfig[team.luckRating];
          const Icon = config.icon;
          const barWidth = (Math.abs(team.luckFactor) / maxLuck) * 100;
          const isPositive = team.luckFactor >= 0;

          return (
            <div
              key={team.rosterId}
              className={`p-3 transition-colors ${
                isUser ? "bg-blue-500/5" : "hover:bg-[#222]"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank/Icon */}
                <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${config.bg} ${config.border} border`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
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
                  </div>

                  {/* Luck bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden relative">
                      {/* Center line */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />
                      {/* Luck bar */}
                      <div
                        className={`absolute top-0 h-full rounded-full transition-all ${
                          isPositive ? "bg-emerald-500" : "bg-red-500"
                        }`}
                        style={{
                          left: isPositive ? "50%" : `${50 - barWidth / 2}%`,
                          width: `${barWidth / 2}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                    <span>{team.wins}-{team.losses}</span>
                    <span>Exp: {team.expectedWins}</span>
                    <span>#{team.pointsForRank} in pts</span>
                  </div>
                </div>

                {/* Luck value */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-lg font-bold ${config.color}`}>
                    {isPositive ? "+" : ""}{team.luckFactor}
                  </div>
                  <div className="text-[9px] text-gray-500">{config.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

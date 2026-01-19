"use client";

import useSWR from "swr";
import Link from "next/link";
import { Clover, TrendingUp, TrendingDown, Minus, Info, Frown, Smile, ChevronRight } from "lucide-react";

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
  condensed?: boolean;
  viewAllHref?: string;
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
export function LuckFactor({ leagueId, userRosterId, condensed = false, viewAllHref }: LuckFactorProps) {
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
        <div className="px-4 py-4 border-b border-[#2a2a2a]">
          <div className="h-8 w-32 bg-[#2a2a2a] rounded" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-[#2a2a2a] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.luckRatings) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <Clover className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-base text-gray-400 font-medium">Luck data unavailable</p>
        <p className="text-sm text-gray-600 mt-1">Play more games to see luck factors</p>
      </div>
    );
  }

  const { luckRatings, leagueStats } = data;
  const maxLuck = Math.max(...luckRatings.map(r => Math.abs(r.luckFactor)), 1);

  // Get condensed items (top 2 + user + bottom 2 for luck)
  const getCondensedItems = (): { items: Array<LuckRating & { showSeparator?: boolean }>; hasMore: boolean } => {
    if (luckRatings.length <= 5) {
      return { items: luckRatings.map(r => ({ ...r })), hasMore: false };
    }

    const top2 = luckRatings.slice(0, 2);
    const bottom2 = luckRatings.slice(-2);
    const userIndex = userRosterId ? luckRatings.findIndex(r => r.rosterId === userRosterId) : -1;
    const userInTop = userIndex >= 0 && userIndex < 2;
    const userInBottom = userIndex >= luckRatings.length - 2;

    if (userInTop || userInBottom || userIndex === -1) {
      return {
        items: [
          ...top2.map(r => ({ ...r })),
          { ...luckRatings[2], showSeparator: true },
          ...bottom2.map(r => ({ ...r })),
        ],
        hasMore: true,
      };
    }

    // User is in middle
    return {
      items: [
        ...top2.map(r => ({ ...r })),
        { ...luckRatings[userIndex], showSeparator: true },
        ...bottom2.map(r => ({ ...r })),
      ],
      hasMore: true,
    };
  };

  const { items: displayRatings, hasMore } = condensed
    ? getCondensedItems()
    : { items: luckRatings.map(r => ({ ...r })), hasMore: false };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Clover className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Luck Factor</h3>
              {!condensed && (
                <p className="text-sm text-gray-500">Actual wins vs expected based on points scored</p>
              )}
            </div>
          </div>
          {!condensed && (
            <div className="group relative">
              <Info className="w-5 h-5 text-gray-500 hover:text-gray-300 cursor-help" />
              <div className="absolute right-0 top-7 w-56 p-3 bg-[#222] border border-[#333] rounded-lg text-sm text-gray-400 hidden group-hover:block z-10">
                Luck = Actual Wins - Expected Wins. Expected wins based on your points scored relative to the league.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats summary - hide in condensed */}
      {!condensed && (
        <div className="grid grid-cols-2 gap-3 p-4 border-b border-[#2a2a2a]">
          <div className="bg-[#222] rounded-md p-3 text-center">
            <Smile className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-sm text-gray-500">Luckiest</p>
            <p className="text-base font-medium text-white truncate">{leagueStats.luckiestTeam}</p>
          </div>
          <div className="bg-[#222] rounded-md p-3 text-center">
            <Frown className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-sm text-gray-500">Unluckiest</p>
            <p className="text-base font-medium text-white truncate">{leagueStats.unluckiestTeam}</p>
          </div>
        </div>
      )}

      {/* Luck ratings list */}
      <div className="divide-y divide-[#2a2a2a]">
        {displayRatings.map((team) => {
          const teamWithSeparator = team as typeof team & { showSeparator?: boolean };
          const isUser = team.rosterId === userRosterId;
          const config = ratingConfig[team.luckRating];
          const Icon = config.icon;
          const barWidth = (Math.abs(team.luckFactor) / maxLuck) * 100;
          const isPositive = team.luckFactor >= 0;

          return (
            <div key={team.rosterId}>
              {/* Separator for condensed mode */}
              {teamWithSeparator.showSeparator && (
                <div className="flex items-center gap-2 py-1.5 px-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#333] to-transparent" />
                  <span className="text-xs text-gray-600 font-medium">...</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#333] to-transparent" />
                </div>
              )}
              <div
                className={`${condensed ? "p-3" : "p-4"} transition-colors ${condensed ? "min-h-[56px]" : "min-h-[72px]"} ${
                  isUser ? "bg-blue-500/5" : "hover:bg-[#222]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank/Icon */}
                  <div className={`${condensed ? "w-8 h-8" : "w-10 h-10"} rounded-md flex items-center justify-center flex-shrink-0 ${config.bg} ${config.border} border`}>
                    <Icon className={`${condensed ? "w-4 h-4" : "w-5 h-5"} ${config.color}`} />
                  </div>

                  {/* Team info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`${condensed ? "text-sm" : "text-base"} font-medium truncate ${isUser ? "text-blue-400" : "text-white"}`}>
                        {team.teamName}
                      </span>
                      {isUser && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-bold">
                          YOU
                        </span>
                      )}
                    </div>

                    {/* Luck bar - hide in condensed */}
                    {!condensed && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden relative">
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
                    )}

                    {/* Details - simplified in condensed */}
                    <div className={`flex items-center gap-4 ${condensed ? "mt-1" : "mt-2"} text-sm text-gray-500`}>
                      <span className="font-medium">{team.wins}-{team.losses}</span>
                      {!condensed && <span>Exp: {team.expectedWins}</span>}
                      {!condensed && <span>#{team.pointsForRank} in pts</span>}
                    </div>
                  </div>

                  {/* Luck value */}
                  <div className="text-right flex-shrink-0">
                    <div className={`${condensed ? "text-lg" : "text-xl"} font-bold ${config.color}`}>
                      {isPositive ? "+" : ""}{team.luckFactor}
                    </div>
                    {!condensed && <div className="text-sm text-gray-500">{config.label}</div>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View All link for condensed mode */}
      {condensed && hasMore && viewAllHref && (
        <Link
          href={viewAllHref}
          className="group flex items-center justify-center gap-1 py-3 text-sm text-blue-500 hover:text-blue-400 font-medium transition-colors hover:bg-[#222] border-t border-[#2a2a2a]"
        >
          View All ({luckRatings.length})
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}

"use client";

import useSWR from "swr";
import Link from "next/link";
import { Sparkles, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { InfoModal } from "./InfoModal";
import { cn } from "@/lib/design-tokens";
import { LuckGauge } from "./LuckGauge";

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
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/25",
    gradient: "from-emerald-500 to-cyan-500",
    label: "Very Lucky",
    icon: TrendingUp,
  },
  lucky: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    gradient: "from-blue-500 to-emerald-400",
    label: "Lucky",
    icon: TrendingUp,
  },
  neutral: {
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    gradient: "from-slate-500 to-slate-400",
    label: "Neutral",
    icon: Minus,
  },
  unlucky: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    gradient: "from-amber-500 to-orange-400",
    label: "Unlucky",
    icon: TrendingDown,
  },
  very_unlucky: {
    color: "text-rose-400",
    bg: "bg-rose-500/15",
    border: "border-rose-500/25",
    gradient: "from-rose-500 to-red-500",
    label: "Very Unlucky",
    icon: TrendingDown,
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
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  if (isLoading) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/[0.05] animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-28 bg-white/[0.05] rounded animate-pulse" />
              <div className="h-3 w-48 bg-white/[0.05] rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-white/[0.03] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.luckRatings) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-slate-500" />
        </div>
        <p className="text-base text-slate-300 font-medium">Luck data unavailable</p>
        <p className="text-sm text-slate-500 mt-1">Play more games to see luck factors</p>
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
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/25 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Luck Factor</h3>
              {!condensed && (
                <p className="text-sm text-slate-500">Actual wins vs expected based on points scored</p>
              )}
            </div>
          </div>
          <InfoModal
            title="Luck Factor"
            description={
              <>
                The Luck Factor measures how much your record over/under-performs based on your scoring.
                A team that scores a lot but loses close games will have negative luck, while a team
                that wins despite lower scoring has positive luck.
              </>
            }
            formula={{
              label: "Luck Formula",
              expression: "Luck = Actual Wins - Expected Wins",
              variables: [
                { name: "Actual Wins", description: "Your actual win count this season" },
                { name: "Expected Wins", description: "Calculated based on points scored rank" },
              ],
            }}
            examples={[
              {
                label: "High Scorer, Bad Record",
                description: "Team ranks #2 in points but has 4-8 record",
                result: "Luck: -4.2",
              },
              {
                label: "Low Scorer, Good Record",
                description: "Team ranks #9 in points but has 7-5 record",
                result: "Luck: +2.8",
              },
              {
                label: "Fair Record",
                description: "Points rank matches win rank closely",
                result: "Luck: ±0.5",
              },
            ]}
            interpretation={[
              { value: "+3 or more", meaning: "Very Lucky", color: "text-emerald-400" },
              { value: "+1 to +2.9", meaning: "Lucky", color: "text-green-400" },
              { value: "-0.9 to +0.9", meaning: "Neutral", color: "text-gray-400" },
              { value: "-1 to -2.9", meaning: "Unlucky", color: "text-orange-400" },
              { value: "-3 or less", meaning: "Very Unlucky", color: "text-red-400" },
            ]}
            sections={[
              {
                title: "How Expected Wins are Calculated",
                content: (
                  <p>
                    Expected Wins = (Teams - PointsRank) / (Teams - 1) × Games Played.
                    The #1 scorer is expected to win most games, while the last place scorer
                    is expected to win the fewest.
                  </p>
                ),
              },
            ]}
            iconSize={18}
          />
        </div>
      </div>

      {/* Stats summary - hide in condensed */}
      {!condensed && (
        <div className="grid grid-cols-2 gap-3 p-4 border-b border-white/[0.06]">
          <div className="bg-[#131a28] rounded-lg p-4 text-center border border-white/[0.04]">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Luckiest</p>
            <p className="text-sm font-semibold text-white truncate mt-1">{leagueStats.luckiestTeam}</p>
          </div>
          <div className="bg-[#131a28] rounded-lg p-4 text-center border border-white/[0.04]">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center mx-auto mb-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Unluckiest</p>
            <p className="text-sm font-semibold text-white truncate mt-1">{leagueStats.unluckiestTeam}</p>
          </div>
        </div>
      )}

      {/* Luck ratings list */}
      <div className="divide-y divide-white/[0.04]">
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
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
                  <span className="text-xs text-slate-600 font-medium">•••</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
                </div>
              )}
              <div
                className={cn(
                  "transition-colors",
                  condensed ? "p-3 min-h-[56px]" : "p-4 min-h-[72px]",
                  isUser ? "bg-blue-500/[0.08]" : "hover:bg-[#131a28]"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Rank/Icon */}
                  <div className={cn(
                    "rounded-lg flex items-center justify-center flex-shrink-0 border",
                    condensed ? "w-8 h-8" : "w-10 h-10",
                    config.bg,
                    config.border
                  )}>
                    <Icon className={cn(condensed ? "w-4 h-4" : "w-5 h-5", config.color)} />
                  </div>

                  {/* Team info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium truncate",
                        condensed ? "text-sm" : "text-base",
                        isUser ? "text-blue-400" : "text-white"
                      )}>
                        {team.teamName}
                      </span>
                      {isUser && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-md font-bold uppercase tracking-wider">
                          You
                        </span>
                      )}
                    </div>

                    {/* Luck bar - hide in condensed */}
                    {!condensed && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden relative">
                          {/* Center line */}
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
                          {/* Luck bar */}
                          <div
                            className={cn(
                              "absolute top-0 h-full rounded-full transition-all duration-500",
                              isPositive
                                ? "bg-gradient-to-r from-blue-500 to-emerald-400"
                                : "bg-gradient-to-l from-blue-500 to-rose-400"
                            )}
                            style={{
                              left: isPositive ? "50%" : `${50 - barWidth / 2}%`,
                              width: `${barWidth / 2}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Details - simplified in condensed */}
                    <div className={cn(
                      "flex items-center gap-4 text-sm text-slate-500",
                      condensed ? "mt-1" : "mt-2"
                    )}>
                      <span className="font-medium">{team.wins}-{team.losses}</span>
                      {!condensed && <span className="text-slate-600">Exp: {team.expectedWins}</span>}
                      {!condensed && <span className="text-slate-600">#{team.pointsForRank} in pts</span>}
                    </div>
                  </div>

                  {/* Luck value */}
                  <div className="text-right flex-shrink-0">
                    <div className={cn(
                      "font-bold tabular-nums",
                      condensed ? "text-lg" : "text-xl",
                      config.color
                    )}>
                      {isPositive ? "+" : ""}{team.luckFactor}
                    </div>
                    {!condensed && (
                      <div className={cn("text-xs font-medium mt-0.5", config.color, "opacity-75")}>
                        {config.label}
                      </div>
                    )}
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
          className="group flex items-center justify-center gap-1.5 py-3.5 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors hover:bg-[#131a28] border-t border-white/[0.06]"
        >
          View All ({luckRatings.length})
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}

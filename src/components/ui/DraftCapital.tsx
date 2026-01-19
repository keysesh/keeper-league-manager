"use client";

import { useMemo, useState } from "react";
import { Info, X, Star } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar, TeamLogo } from "@/components/players/PlayerAvatar";

interface DraftPick {
  season: number;
  round: number;
  originalOwnerSleeperId: string;
  currentOwnerSleeperId: string;
  originalOwnerName?: string;
  currentOwnerName?: string;
}

interface Keeper {
  id: string;
  playerId?: string;
  sleeperId?: string;
  player: {
    fullName: string;
    position: string | null;
    team: string | null;
    sleeperId?: string;
  };
  finalCost: number;
  type: string;
  yearsKept?: number;
}

interface DraftCapitalProps {
  picks: DraftPick[];
  teamSleeperId: string;
  teamName?: string;
  maxRounds?: number;
  showSeasons?: number;
  compact?: boolean;
  /** Hide component if team has all their picks and no acquired picks */
  hideIfDefault?: boolean;
  /** All picks in the league (to show who has traded picks) */
  allPicks?: DraftPick[];
  /** Keeper assignments to display in rounds */
  keepers?: Keeper[];
}

/**
 * Draft Capital summary showing owned/traded picks with improved clarity
 */
export function DraftCapital({
  picks,
  teamSleeperId,
  teamName,
  maxRounds = 16,
  showSeasons = 3,
  compact = false,
  hideIfDefault = false,
  allPicks,
  keepers = [],
}: DraftCapitalProps) {
  const currentYear = new Date().getFullYear();
  const seasons = useMemo(
    () => Array.from({ length: showSeasons }, (_, i) => currentYear + i),
    [currentYear, showSeasons]
  );

  // Mobile tooltip state
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Group picks by season
  const picksBySeason = useMemo(() => {
    const grouped = new Map<number, DraftPick[]>();
    for (const season of seasons) {
      grouped.set(season, []);
    }

    for (const pick of picks) {
      if (pick.currentOwnerSleeperId === teamSleeperId && seasons.includes(pick.season)) {
        const seasonPicks = grouped.get(pick.season) || [];
        seasonPicks.push(pick);
        grouped.set(pick.season, seasonPicks);
      }
    }

    return grouped;
  }, [picks, teamSleeperId, seasons]);

  // Find who has our traded picks
  const tradedPicksInfo = useMemo(() => {
    const tradedInfo = new Map<string, DraftPick>(); // key: "season-round"
    const picksToCheck = allPicks || picks;

    for (const pick of picksToCheck) {
      // This is our original pick that someone else now owns
      if (
        pick.originalOwnerSleeperId === teamSleeperId &&
        pick.currentOwnerSleeperId !== teamSleeperId &&
        seasons.includes(pick.season)
      ) {
        tradedInfo.set(`${pick.season}-${pick.round}`, pick);
      }
    }

    return tradedInfo;
  }, [picks, allPicks, teamSleeperId, seasons]);

  // Map keepers by their final cost (round)
  const keepersByRound = useMemo(() => {
    const map = new Map<number, Keeper[]>();
    for (const keeper of keepers) {
      const round = keeper.finalCost;
      if (!map.has(round)) {
        map.set(round, []);
      }
      map.get(round)!.push(keeper);
    }
    return map;
  }, [keepers]);

  // Calculate summary stats with details - focused on current/first season
  const summary = useMemo(() => {
    // Get the first (current) season for the summary display
    const currentSeason = seasons[0];
    const currentSeasonPicks = picksBySeason.get(currentSeason) || [];

    // Summary stats are for current season only
    const totalOwned = currentSeasonPicks.length;
    const totalPossible = maxRounds;

    let ownPicks = 0;
    let acquiredPicks = 0;
    const acquiredFrom = new Map<string, number>(); // owner name -> count
    const tradedTo = new Map<string, number>(); // owner name -> count

    for (const pick of currentSeasonPicks) {
      if (pick.originalOwnerSleeperId === teamSleeperId) {
        ownPicks++;
      } else {
        acquiredPicks++;
        const fromName = pick.originalOwnerName || "Unknown";
        acquiredFrom.set(fromName, (acquiredFrom.get(fromName) || 0) + 1);
      }
    }

    // Count traded away picks for current season only
    let tradedAwayCount = 0;
    for (const [key, pick] of tradedPicksInfo) {
      if (pick.season === currentSeason) {
        tradedAwayCount++;
        const toName = pick.currentOwnerName || "Unknown";
        tradedTo.set(toName, (tradedTo.get(toName) || 0) + 1);
      }
    }

    const hasNotableActivity = acquiredPicks > 0 || totalOwned < totalPossible;

    return {
      totalOwned,
      totalPossible,
      ownPicks,
      acquiredPicks,
      tradedAway: tradedAwayCount,
      percentage: Math.round((totalOwned / totalPossible) * 100),
      hasNotableActivity,
      acquiredFrom,
      tradedTo,
    };
  }, [picksBySeason, seasons, maxRounds, teamSleeperId, tradedPicksInfo]);

  // Hide if nothing notable and hideIfDefault is true
  if (hideIfDefault && !summary.hasNotableActivity) {
    return null;
  }

  // Build summary text
  const buildSummaryText = () => {
    const parts: string[] = [];

    if (summary.acquiredFrom.size > 0) {
      const acquisitions = Array.from(summary.acquiredFrom.entries())
        .map(([name, count]) => `${count} from ${name}`)
        .join(", ");
      parts.push(`acquired ${acquisitions}`);
    }

    if (summary.tradedTo.size > 0) {
      const trades = Array.from(summary.tradedTo.entries())
        .map(([name, count]) => `${count} to ${name}`)
        .join(", ");
      parts.push(`traded ${trades}`);
    }

    if (parts.length === 0) return null;
    return parts.join("; ");
  };

  const summaryText = buildSummaryText();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-400">Draft Capital:</span>
        <span
          className={`text-xs font-bold ${
            summary.percentage >= 100
              ? "text-emerald-400"
              : summary.percentage >= 75
              ? "text-blue-400"
              : summary.percentage >= 50
              ? "text-amber-400"
              : "text-red-400"
          }`}
        >
          {summary.totalOwned}/{summary.totalPossible}
        </span>
        {summary.acquiredPicks > 0 && (
          <span className="text-[10px] text-emerald-400">+{summary.acquiredPicks}</span>
        )}
        {summary.tradedAway > 0 && (
          <span className="text-[10px] text-red-400">-{summary.tradedAway}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">
            {summary.totalOwned}/{summary.totalPossible} Picks
          </span>
          <span
            className={`text-sm font-semibold px-2 py-0.5 rounded ${
              summary.percentage >= 100
                ? "bg-emerald-500/20 text-emerald-400"
                : summary.percentage >= 75
                ? "bg-blue-500/20 text-blue-400"
                : summary.percentage >= 50
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {summary.percentage}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          {summary.acquiredPicks > 0 && (
            <span className="text-sm px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
              +{summary.acquiredPicks} acquired
            </span>
          )}
          {summary.tradedAway > 0 && (
            <span className="text-sm px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
              -{summary.tradedAway} traded
            </span>
          )}
        </div>
      </div>

      {/* Summary text */}
      {summaryText && (
        <p className="text-sm text-gray-400 bg-[#1a1a1a] rounded-md px-3 py-2 border border-[#2a2a2a]">
          {summaryText}
        </p>
      )}

      {/* Season breakdown */}
      {seasons.map((season) => {
        const seasonPicks = picksBySeason.get(season) || [];
        const ownPicks = seasonPicks.filter(
          (p) => p.originalOwnerSleeperId === teamSleeperId
        );
        const acquiredPicks = seasonPicks.filter(
          (p) => p.originalOwnerSleeperId !== teamSleeperId
        );

        return (
          <div key={season}>
            {/* Season header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">{season}</span>
              <div className="flex items-center gap-2">
                {acquiredPicks.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                    +{acquiredPicks.length}
                  </span>
                )}
                {Array.from(tradedPicksInfo.values()).filter(p => p.season === season).length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
                    -{Array.from(tradedPicksInfo.values()).filter(p => p.season === season).length}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {seasonPicks.length}/{maxRounds}
                </span>
              </div>
            </div>

            {/* Picks grid - use larger cells when keepers are present */}
            <div className={`grid gap-2 ${
              keepers.length > 0
                ? "grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8"
                : "grid-cols-4 sm:grid-cols-8 md:grid-cols-8 lg:grid-cols-16"
            }`}>
              {Array.from({ length: maxRounds }, (_, i) => i + 1).map((round) => {
                const ownPick = ownPicks.find((p) => p.round === round);
                const acquiredPick = acquiredPicks.find((p) => p.round === round);
                const hasPick = ownPick || acquiredPick;
                const tradedPick = tradedPicksInfo.get(`${season}-${round}`);
                const tooltipKey = `${season}-${round}`;
                const keepersInRound = keepersByRound.get(round) || [];
                const hasKeeper = keepersInRound.length > 0;

                // Build tooltip content
                let tooltipContent = "";
                if (acquiredPick) {
                  tooltipContent = `R${round} acquired from ${acquiredPick.originalOwnerName || "trade"}`;
                } else if (ownPick) {
                  tooltipContent = `R${round} (own pick)`;
                } else if (tradedPick) {
                  tooltipContent = `R${round} traded to ${tradedPick.currentOwnerName || "another team"}`;
                }

                // Render keeper card if there's a keeper in this round
                if (hasKeeper) {
                  const keeper = keepersInRound[0];
                  const isFranchise = keeper.type === "FRANCHISE";
                  const yearsKept = keeper.yearsKept || 1;
                  const isAcquiredPick = !!acquiredPick;

                  // Get display name (J. LastName format)
                  const nameParts = keeper.player.fullName.split(" ");
                  const firstName = nameParts[0] || "";
                  const lastName = nameParts.slice(1).join(" ") || "";
                  const displayName = lastName ? `${firstName.charAt(0)}. ${lastName}` : firstName;

                  // Get sleeper ID for avatar
                  const sleeperId = keeper.sleeperId || keeper.playerId || keeper.player.sleeperId || keeper.id;

                  return (
                    <div
                      key={round}
                      className={`
                        relative rounded-lg overflow-hidden
                        ${isFranchise
                          ? "bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-2 border-amber-500/40"
                          : isAcquiredPick
                            ? "bg-[#1a1a1a] border border-emerald-500/40"
                            : "bg-[#1a1a1a] border border-[#333]"
                        }
                      `}
                    >
                      {/* Round header with badges */}
                      <div className={`flex items-center justify-between px-2 py-1.5 ${
                        isFranchise ? "bg-amber-500/10" : "bg-[#222]"
                      }`}>
                        <span className={`text-[10px] font-bold ${
                          isFranchise ? "text-amber-400" : isAcquiredPick ? "text-emerald-400" : "text-gray-400"
                        }`}>
                          R{round}
                        </span>
                        <div className="flex items-center gap-1">
                          {isAcquiredPick && !isFranchise && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                              +ACQ
                            </span>
                          )}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isFranchise
                              ? "bg-amber-400/30 text-amber-200"
                              : yearsKept >= 3
                                ? "bg-red-500/30 text-red-200"
                                : yearsKept === 2
                                  ? "bg-yellow-500/30 text-yellow-200"
                                  : "bg-[#333] text-gray-300"
                          }`}>
                            {isFranchise ? "FT" : `Y${yearsKept}`}
                          </span>
                        </div>
                      </div>

                      {/* Player card content */}
                      <div className="p-2 flex items-center gap-2">
                        {/* Avatar with team overlay */}
                        <div className="relative shrink-0">
                          <div className={`rounded-md overflow-hidden ${
                            isFranchise ? "ring-2 ring-amber-400/50" : "ring-1 ring-[#444]"
                          }`}>
                            <PlayerAvatar
                              sleeperId={sleeperId}
                              name={keeper.player.fullName}
                              size="md"
                            />
                          </div>
                          {keeper.player.team && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1a1a1a] ring-1 ring-[#333] flex items-center justify-center">
                              <TeamLogo team={keeper.player.team} size="xs" />
                            </div>
                          )}
                        </div>

                        {/* Player info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <PositionBadge position={keeper.player.position} size="xs" />
                            {isFranchise && <Star size={10} className="text-amber-400" />}
                          </div>
                          <p className="text-[11px] font-bold text-white truncate leading-tight" title={keeper.player.fullName}>
                            {displayName}
                          </p>
                          {keeper.player.team && (
                            <p className="text-[9px] text-gray-500">{keeper.player.team}</p>
                          )}
                        </div>
                      </div>

                      {/* Multi-keeper indicator */}
                      {keepersInRound.length > 1 && (
                        <div className="absolute -right-1 -bottom-1">
                          <span className="text-[8px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                            +{keepersInRound.length - 1}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }

                // Render standard pick cell (no keeper)
                return (
                  <div
                    key={round}
                    className="relative"
                    onClick={() => setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey)}
                  >
                    <div
                      className={`
                        flex items-center justify-center rounded-md text-xs font-semibold transition-all cursor-pointer
                        ${keepers.length > 0 ? "h-[88px]" : "h-9"}
                        ${acquiredPick
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 ring-1 ring-emerald-500/20 hover:ring-emerald-500/40"
                          : ownPick
                          ? "bg-[#2a2a2a] text-gray-300 border border-[#3a3a3a] hover:border-[#4a4a4a]"
                          : "bg-[#1a1a1a] text-gray-600 border border-dashed border-[#333] hover:border-[#444]"
                        }
                      `}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold">R{round}</span>
                        {keepers.length > 0 && (
                          <span className="text-[9px] text-gray-500">
                            {tradedPick ? "Traded" : acquiredPick ? "Acquired" : ownPick ? "Available" : "—"}
                          </span>
                        )}
                      </div>
                      {acquiredPick && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-white font-bold shadow-sm">
                          +
                        </span>
                      )}
                      {!hasPick && tradedPick && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-5 h-px bg-red-500/60 rotate-45 absolute" />
                        </span>
                      )}
                    </div>

                    {/* Mobile-friendly tooltip (click to show) */}
                    {activeTooltip === tooltipKey && tooltipContent && (
                      <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px]">
                        <div className="bg-[#222] border border-[#333] rounded-md shadow-xl px-3 py-2 text-xs text-white">
                          <div className="flex items-start justify-between gap-2">
                            <span>{tooltipContent}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveTooltip(null); }}
                              className="text-gray-500 hover:text-white"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-[#222] border-r border-b border-[#333] rotate-45 -bottom-1" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Traded pick details for this season */}
            {Array.from(tradedPicksInfo.values()).filter(p => p.season === season).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from(tradedPicksInfo.values())
                  .filter(p => p.season === season)
                  .sort((a, b) => a.round - b.round)
                  .map(pick => (
                    <span
                      key={`traded-${pick.round}`}
                      className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20"
                    >
                      R{pick.round} → {pick.currentOwnerName || "?"}
                    </span>
                  ))
                }
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 text-[10px] text-gray-500 border-t border-[#2a2a2a]">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-[#2a2a2a] border border-[#3a3a3a] flex items-center justify-center text-[9px] text-gray-400 font-semibold">R1</span>
          <span>Own pick</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[9px] text-emerald-400 font-semibold">R1</span>
          <span>Acquired</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-[#1a1a1a] border border-dashed border-[#333] flex items-center justify-center text-[9px] text-gray-600 font-semibold relative">
            <span className="w-3 h-px bg-red-500/40 rotate-45 absolute" />
            R1
          </span>
          <span>Traded</span>
        </div>
        {keepers.length > 0 && (
          <>
            <div className="w-px h-4 bg-[#333] hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center">
                <Star size={10} className="text-amber-400" />
              </span>
              <span>Franchise Tag</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                <span className="px-1 py-0.5 rounded bg-[#333] text-gray-300 text-[8px] font-bold">Y1</span>
                <span className="px-1 py-0.5 rounded bg-yellow-500/30 text-yellow-200 text-[8px] font-bold">Y2</span>
                <span className="px-1 py-0.5 rounded bg-red-500/30 text-red-200 text-[8px] font-bold">Y3</span>
              </div>
              <span>Keeper Years</span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <Info size={12} className="text-gray-600" />
          <span>Tap picks for details</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact pick badge for inline use
 */
export function PickBadge({
  round,
  season,
  isAcquired = false,
  originalOwner,
}: {
  round: number;
  season: number;
  isAcquired?: boolean;
  originalOwner?: string;
}) {
  return (
    <span
      className={`
        inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium
        ${isAcquired
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-gray-700 text-gray-300"
        }
      `}
      title={isAcquired ? `From ${originalOwner || "trade"}` : `Own ${season} R${round}`}
    >
      &apos;{String(season).slice(-2)} R{round}
    </span>
  );
}

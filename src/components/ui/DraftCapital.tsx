"use client";

import { useMemo } from "react";

interface DraftPick {
  season: number;
  round: number;
  originalOwnerSleeperId: string;
  currentOwnerSleeperId: string;
  originalOwnerName?: string;
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
}

/**
 * Draft Capital summary showing owned/traded picks
 */
export function DraftCapital({
  picks,
  teamSleeperId,
  teamName,
  maxRounds = 16,
  showSeasons = 3,
  compact = false,
  hideIfDefault = false,
}: DraftCapitalProps) {
  const currentYear = new Date().getFullYear();
  const seasons = useMemo(
    () => Array.from({ length: showSeasons }, (_, i) => currentYear + i),
    [currentYear, showSeasons]
  );

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

  // Calculate summary stats
  const summary = useMemo(() => {
    let totalOwned = 0;
    let totalPossible = 0;
    let ownPicks = 0;
    let acquiredPicks = 0;

    for (const season of seasons) {
      const seasonPicks = picksBySeason.get(season) || [];
      totalOwned += seasonPicks.length;
      totalPossible += maxRounds;

      for (const pick of seasonPicks) {
        if (pick.originalOwnerSleeperId === teamSleeperId) {
          ownPicks++;
        } else {
          acquiredPicks++;
        }
      }
    }

    // Check if there's anything notable (acquired picks or missing picks)
    const hasNotableActivity = acquiredPicks > 0 || totalOwned < totalPossible;

    return {
      totalOwned,
      totalPossible,
      ownPicks,
      acquiredPicks,
      percentage: Math.round((totalOwned / totalPossible) * 100),
      hasNotableActivity,
    };
  }, [picksBySeason, seasons, maxRounds, teamSleeperId]);

  // Hide if nothing notable and hideIfDefault is true
  if (hideIfDefault && !summary.hasNotableActivity) {
    return null;
  }

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
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Season breakdown - cleaner grid layout */}
      {seasons.map((season) => {
        const seasonPicks = picksBySeason.get(season) || [];
        const ownPicks = seasonPicks.filter(
          (p) => p.originalOwnerSleeperId === teamSleeperId
        );
        const acquiredPicks = seasonPicks.filter(
          (p) => p.originalOwnerSleeperId !== teamSleeperId
        );
        const tradedAway = maxRounds - seasonPicks.length;

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
                {tradedAway > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
                    -{tradedAway}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {seasonPicks.length}/{maxRounds}
                </span>
              </div>
            </div>

            {/* Picks grid */}
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1.5">
              {Array.from({ length: maxRounds }, (_, i) => i + 1).map((round) => {
                const ownPick = ownPicks.find((p) => p.round === round);
                const acquiredPick = acquiredPicks.find((p) => p.round === round);
                const hasPick = ownPick || acquiredPick;

                return (
                  <div
                    key={round}
                    className={`
                      relative flex items-center justify-center h-8 rounded-md text-xs font-semibold transition-all
                      ${acquiredPick
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 ring-1 ring-emerald-500/20"
                        : ownPick
                        ? "bg-[#2a2a2a] text-gray-300 border border-[#3a3a3a]"
                        : "bg-[#1a1a1a] text-gray-600 border border-dashed border-[#333]"
                      }
                    `}
                    title={
                      acquiredPick
                        ? `Round ${round} (from ${acquiredPick.originalOwnerName || "trade"})`
                        : ownPick
                        ? `Round ${round} (own pick)`
                        : `Round ${round} (traded away)`
                    }
                  >
                    {round}
                    {acquiredPick && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] text-white font-bold">
                        +
                      </span>
                    )}
                    {!hasPick && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-4 h-px bg-red-500/40 rotate-45 absolute" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend - simplified */}
      <div className="flex items-center gap-4 pt-2 text-[10px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-[#2a2a2a] border border-[#3a3a3a]"></span>
          <span>Own</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/30"></span>
          <span>Acquired</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-[#1a1a1a] border border-dashed border-[#333]"></span>
          <span>Traded</span>
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
      title={isAcquired ? `From ${originalOwner || "trade"}` : `Own ${season} Round ${round}`}
    >
      &apos;{String(season).slice(-2)} R{round}
    </span>
  );
}

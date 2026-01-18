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

    return {
      totalOwned,
      totalPossible,
      ownPicks,
      acquiredPicks,
      percentage: Math.round((totalOwned / totalPossible) * 100),
    };
  }, [picksBySeason, seasons, maxRounds, teamSleeperId]);

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
    <div className="rounded-md bg-[#1a1a1a] border border-[#2a2a2a] p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Draft Capital
          </span>
          {teamName && (
            <p className="text-sm font-medium text-white mt-0.5">{teamName}</p>
          )}
        </div>
        <div className="text-right">
          <span
            className={`text-lg font-bold ${
              summary.percentage >= 100
                ? "text-emerald-400"
                : summary.percentage >= 75
                ? "text-blue-400"
                : "text-amber-400"
            }`}
          >
            {summary.totalOwned}
          </span>
          <span className="text-sm text-gray-500">/{summary.totalPossible}</span>
          <p className="text-[10px] text-gray-500">
            {summary.ownPicks} own • {summary.acquiredPicks} acquired
          </p>
        </div>
      </div>

      {/* Season breakdown */}
      <div className="space-y-2">
        {seasons.map((season) => {
          const seasonPicks = picksBySeason.get(season) || [];
          const ownPicks = seasonPicks.filter(
            (p) => p.originalOwnerSleeperId === teamSleeperId
          );
          const acquiredPicks = seasonPicks.filter(
            (p) => p.originalOwnerSleeperId !== teamSleeperId
          );

          return (
            <div key={season} className="bg-[#222222] rounded p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-300">{season}</span>
                <span className="text-[10px] text-gray-500">
                  {seasonPicks.length}/{maxRounds} picks
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {/* Own picks */}
                {ownPicks
                  .sort((a, b) => a.round - b.round)
                  .map((pick) => (
                    <span
                      key={`${pick.season}-${pick.round}-${pick.originalOwnerSleeperId}`}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-700 text-gray-300"
                      title={`Round ${pick.round} (own pick)`}
                    >
                      R{pick.round}
                    </span>
                  ))}

                {/* Acquired picks */}
                {acquiredPicks
                  .sort((a, b) => a.round - b.round)
                  .map((pick) => (
                    <span
                      key={`${pick.season}-${pick.round}-${pick.originalOwnerSleeperId}`}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      title={`Round ${pick.round} (from ${pick.originalOwnerName || "other team"})`}
                    >
                      R{pick.round}
                      <span className="text-[8px] ml-0.5 opacity-75">+</span>
                    </span>
                  ))}

                {/* Missing picks indicator */}
                {seasonPicks.length < maxRounds && (
                  <span
                    className="text-[10px] text-gray-600"
                    title={`${maxRounds - seasonPicks.length} picks traded away`}
                  >
                    ({maxRounds - seasonPicks.length} traded)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[#2a2a2a] text-[9px] text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-700"></span>
          <span>Own</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30"></span>
          <span>Acquired</span>
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

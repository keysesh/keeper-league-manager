"use client";

import { memo } from "react";

interface TeamScheduleInfoProps {
  team: string;
  byeWeek?: number;
  sosRank?: number;
  sos?: number;
  record?: {
    wins: number;
    losses: number;
    ties: number;
  };
  compact?: boolean;
}

/**
 * Displays team schedule info (bye week, SOS, record)
 */
export const TeamScheduleInfo = memo(function TeamScheduleInfo({
  team,
  byeWeek,
  sosRank,
  sos,
  record,
  compact = false,
}: TeamScheduleInfoProps) {
  if (!team || team === "FA") return null;

  const getSosColor = (rank?: number) => {
    if (!rank) return "text-gray-400";
    if (rank <= 8) return "text-red-400"; // Hard schedule
    if (rank >= 25) return "text-green-400"; // Easy schedule
    return "text-yellow-400"; // Medium
  };

  const getSosLabel = (rank?: number) => {
    if (!rank) return "";
    if (rank <= 8) return "Hard";
    if (rank >= 25) return "Easy";
    return "";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {byeWeek && <span>Bye: Wk{byeWeek}</span>}
        {sosRank && (
          <span className={getSosColor(sosRank)}>
            SOS #{sosRank}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {record && (
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Record:</span>
          <span className="text-white font-medium">
            {record.wins}-{record.losses}
            {record.ties > 0 && `-${record.ties}`}
          </span>
        </div>
      )}
      {byeWeek && byeWeek > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Bye:</span>
          <span className="text-white">Week {byeWeek}</span>
        </div>
      )}
      {sosRank && (
        <div className="flex items-center gap-1">
          <span className="text-gray-500">SOS:</span>
          <span className={`font-medium ${getSosColor(sosRank)}`}>
            #{sosRank}
            {getSosLabel(sosRank) && (
              <span className="ml-1 text-xs">({getSosLabel(sosRank)})</span>
            )}
          </span>
          {sos !== undefined && (
            <span className="text-gray-500 text-xs">
              ({(sos * 100).toFixed(1)}%)
            </span>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Badge showing bye week
 */
export const ByeWeekBadge = memo(function ByeWeekBadge({
  week,
  size = "sm",
}: {
  week: number;
  size?: "xs" | "sm" | "md";
}) {
  if (!week || week <= 0) return null;

  const sizeClasses = {
    xs: "text-[9px] px-1 py-0.5",
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
  };

  return (
    <span
      className={`${sizeClasses[size]} rounded bg-gray-700/50 text-gray-400 font-medium`}
    >
      Bye Wk{week}
    </span>
  );
});

/**
 * Badge showing strength of schedule
 */
export const SOSBadge = memo(function SOSBadge({
  rank,
  size = "sm",
}: {
  rank: number;
  size?: "xs" | "sm" | "md";
}) {
  if (!rank) return null;

  const sizeClasses = {
    xs: "text-[9px] px-1 py-0.5",
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
  };

  const getColors = (r: number) => {
    if (r <= 8) return "bg-red-500/20 text-red-400";
    if (r >= 25) return "bg-green-500/20 text-green-400";
    return "bg-yellow-500/20 text-yellow-400";
  };

  return (
    <span
      className={`${sizeClasses[size]} rounded ${getColors(rank)} font-medium`}
      title={`Strength of Schedule Rank: #${rank} (1 = hardest, 32 = easiest)`}
    >
      SOS #{rank}
    </span>
  );
});

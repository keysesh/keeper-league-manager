"use client";

import { PlayerAvatar, TeamLogo } from "./PlayerAvatar";
import { PositionBadge, RookieBadge } from "@/components/ui/PositionBadge";
import { StatPill } from "@/components/ui/StatPill";
import { InjuryIndicator } from "@/components/ui/InjuryIndicator";

interface Player {
  id: string;
  sleeperId: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  team?: string | null;
  age?: number | null;
  yearsExp?: number | null;
  status?: string | null;
  injuryStatus?: string | null;
}

interface Eligibility {
  isEligible: boolean;
  reason: string | null;
  yearsKept: number;
  acquisitionType: string;
}

interface Costs {
  franchise: { baseCost: number; finalCost: number; costBreakdown: string } | null;
  regular: { baseCost: number; finalCost: number; costBreakdown: string } | null;
}

interface ExistingKeeper {
  id: string;
  type: "FRANCHISE" | "REGULAR" | string;
  finalCost: number;
  isLocked: boolean;
}

interface PremiumPlayerCardProps {
  player: Player;
  eligibility?: Eligibility;
  costs?: Costs;
  existingKeeper?: ExistingKeeper | null;
  onClick?: () => void;
  onAddKeeper?: (playerId: string, type: "FRANCHISE" | "REGULAR") => void;
  onRemoveKeeper?: (keeperId: string) => void;
  isLoading?: boolean;
  canAddFranchise?: boolean;
  canAddRegular?: boolean;
  className?: string;
}

const positionColors: Record<string, { bg: string; border: string }> = {
  QB: { bg: "bg-red-500/10", border: "border-l-red-500" },
  RB: { bg: "bg-green-500/10", border: "border-l-green-500" },
  WR: { bg: "bg-blue-500/10", border: "border-l-blue-500" },
  TE: { bg: "bg-orange-500/10", border: "border-l-orange-500" },
  K: { bg: "bg-purple-500/10", border: "border-l-purple-500" },
  DEF: { bg: "bg-gray-500/10", border: "border-l-gray-500" },
};

function getYearsKeptVariant(yearsKept: number, maxYears: number = 2): "info" | "success" | "warning" | "danger" {
  if (yearsKept === 0) return "info";
  if (yearsKept >= maxYears) return "danger";
  if (yearsKept === maxYears - 1) return "warning";
  return "success";
}

function getYearsKeptLabel(yearsKept: number, maxYears: number = 2): string {
  if (yearsKept === 0) return "New";
  if (yearsKept >= maxYears) return "Max";
  if (yearsKept === maxYears - 1) return "Final";
  return `Yr ${yearsKept + 1}`;
}

function getAcquisitionLabel(type: string): string {
  switch (type) {
    case "DRAFTED": return "Draft";
    case "WAIVER": return "Waiver";
    case "FREE_AGENT": return "FA";
    case "TRADE": return "Trade";
    default: return type;
  }
}

export function PremiumPlayerCard({
  player,
  eligibility,
  costs,
  existingKeeper,
  onClick,
  onAddKeeper,
  onRemoveKeeper,
  isLoading = false,
  canAddFranchise = true,
  canAddRegular = true,
  className = "",
}: PremiumPlayerCardProps) {
  const colors = positionColors[player.position || ""] || positionColors.DEF;
  const isKeeper = !!existingKeeper;
  const isEligible = eligibility?.isEligible ?? false;
  const isRookie = player.yearsExp === 0;

  const handleCardClick = () => {
    if (onClick) onClick();
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        premium-player-card border-l-4 ${colors.border} ${colors.bg}
        ${onClick ? "cursor-pointer" : ""}
        ${!isEligible && !isKeeper ? "opacity-50" : ""}
        ${className}
      `}
    >
      {/* Header Row */}
      <div className="flex items-start gap-3">
        <PlayerAvatar
          sleeperId={player.sleeperId}
          name={player.fullName}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white truncate">
              {player.fullName}
            </span>
            {isRookie && <RookieBadge size="xs" />}
            {player.injuryStatus && <InjuryIndicator status={player.injuryStatus} />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <PositionBadge position={player.position} size="xs" variant="filled" />
            <div className="flex items-center gap-1">
              <TeamLogo team={player.team || null} size="xs" />
              <span className="text-[10px] text-gray-400">{player.team || "FA"}</span>
            </div>
            {player.age && (
              <span className="text-[10px] text-gray-500">Age {player.age}</span>
            )}
          </div>
        </div>
        {/* Keeper Type Badge */}
        {isKeeper && (
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded ${
              existingKeeper.type === "FRANCHISE"
                ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black"
                : "bg-gradient-to-r from-purple-500 to-purple-700 text-white"
            }`}
          >
            {existingKeeper.type === "FRANCHISE" ? "FT" : "K"}
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-1.5 mt-3">
        {isKeeper ? (
          <>
            <StatPill value={`R${existingKeeper.finalCost}`} variant="primary" />
            {eligibility && (
              <StatPill
                value={getYearsKeptLabel(eligibility.yearsKept)}
                variant={getYearsKeptVariant(eligibility.yearsKept)}
              />
            )}
            {eligibility?.acquisitionType && (
              <StatPill value={getAcquisitionLabel(eligibility.acquisitionType)} variant="subtle" />
            )}
          </>
        ) : isEligible && costs ? (
          <>
            {costs.regular && (
              <StatPill value={`R${costs.regular.finalCost}`} variant="primary" />
            )}
            {eligibility && (
              <StatPill
                value={getYearsKeptLabel(eligibility.yearsKept)}
                variant={getYearsKeptVariant(eligibility.yearsKept)}
              />
            )}
            {eligibility?.acquisitionType && (
              <StatPill value={getAcquisitionLabel(eligibility.acquisitionType)} variant="subtle" />
            )}
          </>
        ) : eligibility?.reason ? (
          <span className="text-[10px] text-gray-500 italic">{eligibility.reason}</span>
        ) : null}
      </div>

      {/* Action Row */}
      {!isKeeper && isEligible && costs && onAddKeeper && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700/30">
          {costs.regular && (
            <button
              onClick={(e) => handleActionClick(e, () => onAddKeeper(player.id, "REGULAR"))}
              disabled={!canAddRegular || isLoading}
              className="flex-1 px-2 py-1.5 rounded text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-colors"
            >
              {isLoading ? "..." : `Keep R${costs.regular.finalCost}`}
            </button>
          )}
          {costs.franchise && (
            <button
              onClick={(e) => handleActionClick(e, () => onAddKeeper(player.id, "FRANCHISE"))}
              disabled={!canAddFranchise || isLoading}
              className="px-3 py-1.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 transition-colors"
            >
              {isLoading ? "..." : "FT"}
            </button>
          )}
        </div>
      )}

      {/* Remove Keeper Button */}
      {isKeeper && !existingKeeper.isLocked && onRemoveKeeper && (
        <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-700/30">
          <button
            onClick={(e) => handleActionClick(e, () => onRemoveKeeper(existingKeeper.id))}
            disabled={isLoading}
            className="text-[10px] text-red-400 hover:text-red-300 font-medium"
          >
            {isLoading ? "..." : "Remove"}
          </button>
        </div>
      )}
    </div>
  );
}

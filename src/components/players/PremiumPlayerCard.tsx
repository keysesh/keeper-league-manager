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
  consecutiveYears?: number;
  acquisitionType: string;
  originalDraft?: {
    draftYear: number;
    draftRound: number;
  } | null;
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
  onAddKeeper?: (playerId: string, type: "FRANCHISE" | "REGULAR") => void;
  onRemoveKeeper?: (keeperId: string) => void;
  isLoading?: boolean;
  canAddFranchise?: boolean;
  canAddRegular?: boolean;
  className?: string;
}

const positionColors: Record<string, { bg: string; border: string }> = {
  QB: { bg: "bg-red-500/10", border: "border-red-500" },
  RB: { bg: "bg-green-500/10", border: "border-green-500" },
  WR: { bg: "bg-blue-500/10", border: "border-blue-500" },
  TE: { bg: "bg-orange-500/10", border: "border-orange-500" },
  K: { bg: "bg-purple-500/10", border: "border-purple-500" },
  DEF: { bg: "bg-gray-500/10", border: "border-gray-500" },
};

function getYearsKeptLabel(yearsKept: number): string {
  if (yearsKept === 0) return "New";
  if (yearsKept === 1) return "Year 1";
  if (yearsKept === 2) return "Year 2 (Final)";
  return `Year ${yearsKept}`;
}

function getAcquisitionLabel(type: string): string {
  switch (type) {
    case "DRAFTED": return "Drafted";
    case "WAIVER": return "Waiver";
    case "FREE_AGENT": return "Free Agent";
    case "TRADE": return "Trade";
    default: return type;
  }
}

export function PremiumPlayerCard({
  player,
  eligibility,
  costs,
  existingKeeper,
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

  return (
    <div
      className={`
        premium-player-card border-t-4 ${colors.border} ${colors.bg}
        flex flex-col p-3
        ${!isEligible && !isKeeper ? "opacity-60" : ""}
        ${className}
      `}
    >
      {/* Header: Avatar + Name + Badges */}
      <div className="flex items-start gap-3">
        <PlayerAvatar
          sleeperId={player.sleeperId}
          name={player.fullName}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-white truncate">{player.fullName}</span>
            {isRookie && <RookieBadge size="xs" />}
            {player.injuryStatus && <InjuryIndicator status={player.injuryStatus} />}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <PositionBadge position={player.position} size="xs" variant="filled" />
            <TeamLogo team={player.team || null} size="xs" />
            <span className="text-[10px] text-gray-400">{player.team || "FA"}</span>
          </div>
        </div>
        {/* Keeper Badge */}
        {isKeeper && (
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded ${
              existingKeeper.type === "FRANCHISE"
                ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black"
                : "bg-gradient-to-r from-purple-500 to-purple-700 text-white"
            }`}
          >
            {existingKeeper.type === "FRANCHISE" ? "FT" : "Keeper"}
          </span>
        )}
      </div>

      {/* Player Info Grid */}
      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        <div>
          <div className="text-[9px] text-gray-500 uppercase">Age</div>
          <div className="text-xs font-semibold text-white">{player.age || "—"}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500 uppercase">Exp</div>
          <div className="text-xs font-semibold text-white">{player.yearsExp ?? 0}yr</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500 uppercase">Status</div>
          <div className={`text-xs font-semibold ${player.injuryStatus ? "text-red-400" : "text-green-400"}`}>
            {player.injuryStatus || "Active"}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500 uppercase">Elig</div>
          <div className={`text-xs font-semibold ${isEligible || isKeeper ? "text-green-400" : "text-red-400"}`}>
            {isKeeper ? "Kept" : isEligible ? "Yes" : "No"}
          </div>
        </div>
      </div>

      {/* Keeper Status Section */}
      {eligibility && (
        <div className="mt-3 pt-3 border-t border-gray-700/30">
          <div className="grid grid-cols-4 gap-1 text-center">
            <div>
              <div className="text-[9px] text-gray-500 uppercase">Drafted</div>
              <div className="text-[10px] font-semibold text-white">
                {eligibility.originalDraft
                  ? `'${String(eligibility.originalDraft.draftYear).slice(-2)} R${eligibility.originalDraft.draftRound}`
                  : "Undrafted"}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-gray-500 uppercase">Acquired</div>
              <div className="text-[10px] font-semibold text-white">{getAcquisitionLabel(eligibility.acquisitionType)}</div>
            </div>
            <div>
              <div className="text-[9px] text-gray-500 uppercase">Kept</div>
              <div className="text-[10px] font-semibold text-white">
                {eligibility.consecutiveYears === 0 ? "New" : `${eligibility.consecutiveYears}yr`}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-gray-500 uppercase">Cost</div>
              <div className="text-[10px] font-semibold text-purple-400">
                {isKeeper ? `R${existingKeeper.finalCost}` : costs?.regular ? `R${costs.regular.finalCost}` : "—"}
              </div>
            </div>
          </div>

          {/* Cost Breakdown - shows escalation */}
          {costs?.regular && !isKeeper && (eligibility.consecutiveYears ?? 0) > 0 && (
            <div className="mt-2 text-[9px] text-gray-500 text-center">
              {costs.regular.costBreakdown}
            </div>
          )}

          {/* Ineligibility Reason */}
          {!isEligible && !isKeeper && eligibility.reason && (
            <div className="mt-2 text-[9px] text-red-400 text-center italic">
              {eligibility.reason}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {!isKeeper && isEligible && costs && onAddKeeper && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700/30">
          {costs.regular && (
            <button
              onClick={() => onAddKeeper(player.id, "REGULAR")}
              disabled={!canAddRegular || isLoading}
              className="flex-1 py-1.5 rounded text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-colors"
            >
              {isLoading ? "..." : `Keep as R${costs.regular.finalCost}`}
            </button>
          )}
          {costs.franchise && (
            <button
              onClick={() => onAddKeeper(player.id, "FRANCHISE")}
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
        <div className="flex items-center justify-center mt-3 pt-3 border-t border-gray-700/30">
          <button
            onClick={() => onRemoveKeeper(existingKeeper.id)}
            disabled={isLoading}
            className="px-4 py-1.5 rounded text-[10px] font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
          >
            {isLoading ? "Removing..." : "Remove Keeper"}
          </button>
        </div>
      )}
    </div>
  );
}
